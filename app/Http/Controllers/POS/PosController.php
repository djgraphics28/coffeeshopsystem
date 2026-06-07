<?php

namespace App\Http\Controllers\POS;

use App\Events\OrderPlaced;
use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\OrderResource;
use App\Models\Addon;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemVariation;
use App\Models\Order;
use App\Models\Setting;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function index(): Response
    {
        $categories = Category::active()
            ->with(['availableMenuItems.variations', 'availableMenuItems.addonGroups.addons'])
            ->get();

        $tables = Table::active()->get(['id', 'name']);

        $activeOrders = Order::active()
            ->today()
            ->with(['table', 'items.menuItem', 'items.addons.addon', 'payment'])
            ->latest()
            ->get();

        $settings = Setting::getAll();

        return Inertia::render('POS/PosTerminal', [
            'categories' => CategoryResource::collection($categories)->resolve(),
            'tables' => $tables,
            'initialOrders' => OrderResource::collection($activeOrders)->resolve(),
            'settings' => [
                'currency' => $settings['currency'] ?? '₱',
                'tax_rate' => (float) ($settings['tax_rate'] ?? 12),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_id' => ['nullable', 'exists:tables,id'],
            'type' => ['required', Rule::in(['dine-in', 'takeout', 'walkin'])],
            'notes' => ['nullable', 'string', 'max:500'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.menu_item_id' => ['required', 'exists:menu_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.notes' => ['nullable', 'string', 'max:200'],
            'items.*.variation_id' => ['nullable', 'exists:menu_item_variations,id'],
            'items.*.addon_ids' => ['nullable', 'array'],
            'items.*.addon_ids.*' => ['exists:addons,id'],
        ]);

        $order = DB::transaction(function () use ($validated, $request) {
            $taxRate = (float) Setting::get('tax_rate', 12);
            $subtotal = 0;

            $order = Order::create([
                'table_id' => $validated['table_id'] ?? null,
                'order_number' => Order::generateOrderNumber(),
                'status' => 'pending',
                'type' => $validated['type'],
                'notes' => $validated['notes'] ?? null,
                'discount' => $validated['discount'] ?? 0,
                'subtotal' => 0,
                'tax' => 0,
                'total' => 0,
                'created_by' => $request->user()->id,
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

                $addonIds = $itemData['addon_ids'] ?? [];
                $addonTotal = ! empty($addonIds) ? Addon::whereIn('id', $addonIds)->sum('additional_price') : 0;

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

            $discount = min((float) ($validated['discount'] ?? 0), $subtotal);
            $taxable = $subtotal - $discount;
            $tax = round($taxable * ($taxRate / 100), 2);

            $order->update([
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'total' => $taxable + $tax,
            ]);

            return $order;
        });

        broadcast(new OrderPlaced($order))->toOthers();

        return response()->json([
            'order' => (new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon'])))->resolve(),
        ], 201);
    }

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['pending', 'preparing', 'ready', 'completed', 'cancelled'])],
        ]);

        $order->update(['status' => $validated['status']]);

        broadcast(new OrderStatusUpdated($order->fresh()))->toOthers();

        return response()->json([
            'order' => (new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon'])))->resolve(),
        ]);
    }

    public function processPayment(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'method' => ['required', Rule::in(['cash', 'card', 'gcash', 'maya'])],
            'reference_no' => ['nullable', 'string', 'max:100'],
        ]);

        $payment = $order->payment()->firstOrCreate(
            [],
            [
                'amount' => $validated['amount'],
                'method' => $validated['method'],
                'reference_no' => $validated['reference_no'] ?? null,
                'paid_at' => now(),
            ]
        );

        $order->update(['status' => 'completed']);
        broadcast(new OrderStatusUpdated($order->fresh()))->toOthers();

        return response()->json([
            'payment' => $payment,
            'order' => (new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon', 'payment'])))->resolve(),
        ]);
    }
}
