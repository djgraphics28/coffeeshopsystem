<?php

namespace App\Http\Controllers\Customer;

use App\Events\OrderPlaced;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Addon;
use App\Models\MenuItem;
use App\Models\MenuItemVariation;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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

        $order = DB::transaction(function () use ($validated) {
            $taxRate = (float) Setting::get('tax_rate', 12);
            $subtotal = 0;

            $order = Order::create([
                'table_id' => $validated['table_id'],
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'type' => $validated['type'],
                'notes' => $validated['notes'] ?? null,
                'subtotal' => 0,
                'tax' => 0,
                'total' => 0,
            ]);

            foreach ($validated['items'] as $itemData) {
                $menuItem = MenuItem::with('variations')->findOrFail($itemData['menu_item_id']);
                $variationId = $itemData['variation_id'] ?? null;

                if ($menuItem->hasVariations() && ! $variationId) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'items' => ['Please select a size for '.$menuItem->name.'.'],
                    ]);
                }

                if ($variationId) {
                    $belongsToItem = MenuItemVariation::where('id', $variationId)
                        ->where('menu_item_id', $menuItem->id)
                        ->exists();

                    if (! $belongsToItem) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
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

            $tax = round($subtotal * ($taxRate / 100), 2);
            $order->update([
                'subtotal' => $subtotal,
                'tax' => $tax,
                'total' => $subtotal + $tax,
            ]);

            return $order;
        });

        broadcast(new OrderPlaced($order))->toOthers();

        return response()->json([
            'order' => (new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon'])))->resolve(),
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
