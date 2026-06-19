<?php

namespace App\Http\Controllers\Customer;

use App\Events\OrderPlaced;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Addon;
use App\Models\MenuItem;
use App\Models\MenuItemVariation;
use App\Models\Order;
use App\Models\Promo;
use App\Models\PromoUsage;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $scan = $request->session()->get('storefront_qr_scan');

        if (! $scan || (now()->timestamp - $scan['scanned_at']) > 7200) {
            return response()->json([
                'message' => 'Please scan the QR code at your table to place an order.',
            ], 403);
        }

        $validated = $request->validate([
            'table_id' => ['required', 'exists:tables,id'],
            'type' => ['required', Rule::in(['dine-in', 'takeout'])],
            'notes' => ['nullable', 'string', 'max:500'],
            'promo_code' => ['nullable', 'string', 'max:50'],
            'redeem_points' => ['nullable', 'boolean'],
            'use_free_drink' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'exists:menu_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:20'],
            'items.*.notes' => ['nullable', 'string', 'max:200'],
            'items.*.variation_id' => ['nullable', 'exists:menu_item_variations,id'],
            'items.*.addon_ids' => ['nullable', 'array'],
            'items.*.addon_ids.*' => ['exists:addons,id'],
        ]);

        if ($scan['table_id'] !== (int) $validated['table_id']) {
            return response()->json([
                'message' => 'Please scan the QR code at your table to place an order.',
            ], 403);
        }

        $customer = Auth::guard('customer')->user();

        $meta = [];

        $order = DB::transaction(function () use ($validated, $customer, &$meta) {
            $taxRate = (float) Setting::get('tax_rate', 12);
            $subtotal = 0;

            $order = Order::create([
                'table_id' => $validated['table_id'],
                'customer_id' => $customer?->id,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'type' => $validated['type'],
                'notes' => $validated['notes'] ?? null,
                'subtotal' => 0,
                'tax' => 0,
                'discount' => 0,
                'total' => 0,
            ]);

            foreach ($validated['items'] as $itemData) {
                $menuItem = MenuItem::with('variations')->findOrFail($itemData['menu_item_id']);
                $variationId = $itemData['variation_id'] ?? null;

                if ($menuItem->hasVariations() && ! $variationId) {
                    throw ValidationException::withMessages([
                        'items' => ['Please select a size for '.$menuItem->name.'.'],
                    ]);
                }

                if ($variationId) {
                    $belongsToItem = MenuItemVariation::where('id', $variationId)
                        ->where('menu_item_id', $menuItem->id)
                        ->exists();

                    if (! $belongsToItem) {
                        throw ValidationException::withMessages([
                            'items' => ['Invalid size selected for '.$menuItem->name.'.'],
                        ]);
                    }
                }

                $addonTotal = 0;
                $addonIds = $itemData['addon_ids'] ?? [];

                if (! empty($addonIds)) {
                    $addonTotal = Addon::whereIn('id', $addonIds)->sum('additional_price');
                }

                $unitPrice = $menuItem->resolveBasePrice($variationId) + $addonTotal;
                $itemSubtotal = $unitPrice * $itemData['quantity'];
                $subtotal += $itemSubtotal;

                $orderItem = $order->items()->create([
                    'menu_item_id' => $menuItem->id,
                    'menu_item_variation_id' => $variationId,
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $unitPrice,
                    'subtotal' => $itemSubtotal,
                    'notes' => $itemData['notes'] ?? null,
                ]);

                foreach ($addonIds as $addonId) {
                    $addon = Addon::find($addonId);
                    if ($addon) {
                        $orderItem->addons()->create([
                            'addon_id' => $addonId,
                            'additional_price' => $addon->additional_price,
                        ]);
                    }
                }
            }

            // Apply promo
            $promoDiscount = 0;
            $promoId = null;

            if (! empty($validated['promo_code'])) {
                $promo = Promo::where('code', strtoupper(trim($validated['promo_code'])))->first();

                if (! $promo || ! $promo->isValid($subtotal, $customer?->id)) {
                    throw ValidationException::withMessages(['promo_code' => ['Promo code is invalid or no longer valid.']]);
                }

                $promoDiscount = $promo->calculateDiscount($subtotal);
                $promoId = $promo->id;
                $promo->increment('uses_count');

                if ($customer) {
                    PromoUsage::create([
                        'promo_id' => $promo->id,
                        'customer_id' => $customer->id,
                        'order_id' => $order->id,
                    ]);
                }
            }

            // Apply points redemption
            $pointsDiscount = 0;
            $pointsRedeemed = 0;

            if ($customer && ! empty($validated['redeem_points']) && $customer->points > 0) {
                $redeemRate = (int) Setting::get('points_redeem_rate', 100);
                $maxDiscount = $subtotal - $promoDiscount;
                $maxPointsDiscount = $customer->points / $redeemRate;
                $pointsDiscount = min($maxPointsDiscount, $maxDiscount);
                $pointsRedeemed = (int) ceil($pointsDiscount * $redeemRate);
                $pointsDiscount = round($pointsDiscount, 2);
                $customer->decrement('points', $pointsRedeemed);
            }

            // Free drink redemption
            $freeDrinkDiscount = 0;
            $freeDrinkRedeemed = false;

            if ($customer && ! empty($validated['use_free_drink']) && $customer->fresh()->free_drinks_available > 0) {
                // Cheapest unit price among items in this order
                $cheapestPrice = collect($validated['items'])->map(function ($itemData) {
                    $menuItem = MenuItem::find($itemData['menu_item_id']);
                    $variationId = $itemData['variation_id'] ?? null;
                    $addonTotal = ! empty($itemData['addon_ids'])
                        ? Addon::whereIn('id', $itemData['addon_ids'])->sum('additional_price')
                        : 0;

                    return $menuItem->resolveBasePrice($variationId) + $addonTotal;
                })->min();

                $freeDrinkDiscount = round((float) $cheapestPrice, 2);
                $freeDrinkRedeemed = true;
                $customer->decrement('free_drinks_available');
            }

            // Loyalty cup tracking
            $cupsAwarded = 0;
            $freeDrinksEarnedThisOrder = 0;

            if ($customer && Setting::get('loyalty_cups_enabled', '0') === '1') {
                $threshold = (int) Setting::get('loyalty_cups_threshold', 10);
                $cupsInOrder = collect($validated['items'])->sum('quantity');
                $customer->refresh();
                $newTotal = $customer->cup_count + $cupsInOrder;
                $freeDrinksEarnedThisOrder = intdiv($newTotal, $threshold);
                $remainingCups = $newTotal % $threshold;
                $customer->update(['cup_count' => $remainingCups]);

                if ($freeDrinksEarnedThisOrder > 0) {
                    $customer->increment('free_drinks_available', $freeDrinksEarnedThisOrder);
                }

                $cupsAwarded = $cupsInOrder;
            }

            // Final totals — includes promo, points, and free drink discounts
            $totalDiscount = min($promoDiscount + $pointsDiscount + $freeDrinkDiscount, $subtotal);
            $taxable = $subtotal - $totalDiscount;
            $tax = round($taxable * ($taxRate / 100), 2);

            // Award points on the taxable amount after all discounts
            $pointsEarned = 0;

            if ($customer) {
                $earnRate = (float) Setting::get('points_earn_rate', 1);
                $pointsEarned = (int) floor($taxable * $earnRate);
                $customer->increment('points', $pointsEarned);
            }

            $order->update([
                'promo_id' => $promoId,
                'subtotal' => $subtotal,
                'discount' => $totalDiscount,
                'tax' => $tax,
                'total' => $taxable + $tax,
                'points_earned' => $pointsEarned,
                'points_redeemed' => $pointsRedeemed,
                'free_drink_redeemed' => $freeDrinkRedeemed,
                'cups_awarded' => $cupsAwarded,
            ]);

            $meta = [
                'points_earned' => $pointsEarned,
                'free_drinks_earned' => $freeDrinksEarnedThisOrder,
                'cups_awarded' => $cupsAwarded,
                'free_drink_redeemed' => $freeDrinkRedeemed,
                'cup_count' => $customer?->fresh()->cup_count,
                'free_drinks_available' => $customer?->fresh()->free_drinks_available,
            ];

            return $order;
        });

        broadcast(new OrderPlaced(
            $order->fresh()->load(['table', 'items.menuItem', 'items.addons.addon'])
        ))->toOthers();

        return response()->json([
            'order' => (new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon'])))->resolve(),
            'points_earned' => $meta['points_earned'] ?? 0,
            'free_drinks_earned' => $meta['free_drinks_earned'] ?? 0,
            'cups_awarded' => $meta['cups_awarded'] ?? 0,
            'free_drink_redeemed' => $meta['free_drink_redeemed'] ?? false,
            'cup_count' => $meta['cup_count'] ?? null,
            'free_drinks_available' => $meta['free_drinks_available'] ?? null,
        ], 201);
    }

    public function show(Request $request, Order $order): Response
    {
        $settings = Setting::getAll();

        return Inertia::render('Customer/OrderTracker', [
            'order' => (new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon', 'payment'])))->resolve(),
            'settings' => [
                'cafe_name' => $settings['cafe_name'] ?? "Milk&Honey Cafe'",
                'estimated_wait_minutes' => $settings['estimated_wait_minutes'] ?? '10-15',
            ],
        ]);
    }

    public function status(Order $order): JsonResponse
    {
        return response()->json([
            'status' => $order->status,
            'order_number' => $order->order_number,
        ]);
    }
}
