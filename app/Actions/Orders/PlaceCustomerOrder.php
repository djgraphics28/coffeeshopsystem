<?php

namespace App\Actions\Orders;

use App\Models\Addon;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\MenuItemVariation;
use App\Models\Order;
use App\Models\Promo;
use App\Models\PromoUsage;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Places an order on behalf of a signed-in customer: prices every line from the
 * database, applies promo / points / free-drink discounts, tracks loyalty cups,
 * adds the delivery fee and tax, and awards points.
 */
class PlaceCustomerOrder
{
    /**
     * @param  array{
     *     table_id?: int|null,
     *     type: string,
     *     delivery_address?: string|null,
     *     delivery_lat?: float|null,
     *     delivery_lng?: float|null,
     *     payment_method?: string|null,
     *     notes?: string|null,
     *     promo_code?: string|null,
     *     redeem_points?: bool|null,
     *     use_free_drink?: bool|null,
     *     items: list<array{menu_item_id: int, quantity: int, notes?: string|null, variation_id?: int|null, addon_ids?: list<int>|null}>
     * }  $data
     * @return array{order: Order, points_earned: int, free_drinks_earned: int, cups_awarded: int, free_drink_redeemed: bool, cup_count: int, free_drinks_available: int}
     */
    public function handle(Customer $customer, array $data): array
    {
        return DB::transaction(function () use ($customer, $data) {
            $taxRate = (float) Setting::get('tax_rate', 12);
            $subtotal = 0;
            $isDelivery = $data['type'] === 'delivery';

            $order = Order::create([
                'table_id' => $data['table_id'] ?? null,
                'customer_id' => $customer->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'type' => $data['type'],
                'source' => Order::SOURCE_ONLINE,
                'notes' => $data['notes'] ?? null,
                'delivery_address' => $isDelivery ? ($data['delivery_address'] ?? null) : null,
                'delivery_lat' => $isDelivery ? ($data['delivery_lat'] ?? null) : null,
                'delivery_lng' => $isDelivery ? ($data['delivery_lng'] ?? null) : null,
                'payment_method' => $data['payment_method'] ?? null,
                'subtotal' => 0,
                'tax' => 0,
                'discount' => 0,
                'total' => 0,
            ]);

            $unitPrices = [];

            foreach ($data['items'] as $itemData) {
                $menuItem = MenuItem::with('variations')->findOrFail($itemData['menu_item_id']);
                $variationId = $itemData['variation_id'] ?? null;

                if (! $menuItem->is_available) {
                    throw ValidationException::withMessages([
                        'items' => [$menuItem->name.' is no longer available.'],
                    ]);
                }

                if ($menuItem->hasVariations() && ! $variationId) {
                    throw ValidationException::withMessages([
                        'items' => ['Please select a size for '.$menuItem->name.'.'],
                    ]);
                }

                if ($variationId && ! MenuItemVariation::where('id', $variationId)->where('menu_item_id', $menuItem->id)->exists()) {
                    throw ValidationException::withMessages([
                        'items' => ['Invalid size selected for '.$menuItem->name.'.'],
                    ]);
                }

                $addons = Addon::whereIn('id', $itemData['addon_ids'] ?? [])->get();
                $unitPrice = $menuItem->resolveBasePrice($variationId) + (float) $addons->sum('additional_price');
                $itemSubtotal = $unitPrice * $itemData['quantity'];
                $subtotal += $itemSubtotal;
                $unitPrices[] = $unitPrice;

                $orderItem = $order->items()->create([
                    'menu_item_id' => $menuItem->id,
                    'menu_item_variation_id' => $variationId,
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $unitPrice,
                    'subtotal' => $itemSubtotal,
                    'notes' => $itemData['notes'] ?? null,
                ]);

                foreach ($addons as $addon) {
                    $orderItem->addons()->create([
                        'addon_id' => $addon->id,
                        'additional_price' => $addon->additional_price,
                    ]);
                }
            }

            $promoDiscount = 0;
            $promoId = null;

            if (! empty($data['promo_code'])) {
                $promo = Promo::where('code', strtoupper(trim($data['promo_code'])))->first();

                if (! $promo || ! $promo->isValid($subtotal, $customer->id)) {
                    throw ValidationException::withMessages(['promo_code' => ['Promo code is invalid or no longer valid.']]);
                }

                $promoDiscount = $promo->calculateDiscount($subtotal);
                $promoId = $promo->id;
                $promo->increment('uses_count');

                PromoUsage::create([
                    'promo_id' => $promo->id,
                    'customer_id' => $customer->id,
                    'order_id' => $order->id,
                ]);
            }

            $pointsDiscount = 0;
            $pointsRedeemed = 0;

            if (! empty($data['redeem_points']) && $customer->points > 0) {
                $redeemRate = (int) Setting::get('points_redeem_rate', 100);
                $pointsDiscount = min($customer->points / $redeemRate, $subtotal - $promoDiscount);
                $pointsRedeemed = (int) ceil($pointsDiscount * $redeemRate);
                $pointsDiscount = round($pointsDiscount, 2);
                $customer->decrement('points', $pointsRedeemed);
            }

            // A free drink covers the cheapest line in the order.
            $freeDrinkDiscount = 0;
            $freeDrinkRedeemed = false;

            if (! empty($data['use_free_drink']) && $customer->fresh()->free_drinks_available > 0) {
                $freeDrinkDiscount = round((float) min($unitPrices), 2);
                $freeDrinkRedeemed = true;
                $customer->decrement('free_drinks_available');
            }

            $cupsAwarded = 0;
            $freeDrinksEarnedThisOrder = 0;

            if (Setting::get('loyalty_cups_enabled', '0') === '1') {
                $threshold = (int) Setting::get('loyalty_cups_threshold', 10);
                $cupsInOrder = collect($data['items'])->sum('quantity');
                $customer->refresh();
                $newTotal = $customer->cup_count + $cupsInOrder;
                $freeDrinksEarnedThisOrder = intdiv($newTotal, $threshold);
                $customer->update(['cup_count' => $newTotal % $threshold]);

                if ($freeDrinksEarnedThisOrder > 0) {
                    $customer->increment('free_drinks_available', $freeDrinksEarnedThisOrder);
                }

                $cupsAwarded = $cupsInOrder;
            }

            $totalDiscount = min($promoDiscount + $pointsDiscount + $freeDrinkDiscount, $subtotal);
            $taxable = $subtotal - $totalDiscount;
            $tax = round($taxable * ($taxRate / 100), 2);

            // Delivery fee is waived once the subtotal reaches the free-delivery minimum.
            $deliveryFee = 0.0;

            if ($isDelivery) {
                $freeMinimum = (float) Setting::get('free_delivery_minimum', 0);
                $qualifiesForFree = $freeMinimum > 0 && $subtotal >= $freeMinimum;
                $deliveryFee = $qualifiesForFree ? 0.0 : (float) Setting::get('delivery_fee', 0);
            }

            $pointsEarned = (int) floor($taxable * (float) Setting::get('points_earn_rate', 1));
            $customer->increment('points', $pointsEarned);

            $order->update([
                'promo_id' => $promoId,
                'subtotal' => $subtotal,
                'discount' => $totalDiscount,
                'delivery_fee' => $deliveryFee,
                'tax' => $tax,
                'total' => $taxable + $tax + $deliveryFee,
                'points_earned' => $pointsEarned,
                'points_redeemed' => $pointsRedeemed,
                'free_drink_redeemed' => $freeDrinkRedeemed,
                'cups_awarded' => $cupsAwarded,
            ]);

            $customer->refresh();

            return [
                'order' => $order,
                'points_earned' => $pointsEarned,
                'free_drinks_earned' => $freeDrinksEarnedThisOrder,
                'cups_awarded' => $cupsAwarded,
                'free_drink_redeemed' => $freeDrinkRedeemed,
                'cup_count' => $customer->cup_count,
                'free_drinks_available' => $customer->free_drinks_available,
            ];
        });
    }
}
