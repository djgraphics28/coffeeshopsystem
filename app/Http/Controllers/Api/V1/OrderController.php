<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Orders\CancelCustomerOrder;
use App\Actions\Orders\PlaceCustomerOrder;
use App\Events\OnlineOrderPlaced;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Table;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    /**
     * The signed-in customer's order history, newest first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orders = Order::query()
            ->where('customer_id', $request->user()->id)
            ->with(['table', 'items.menuItem', 'items.addons.addon'])
            ->latest()
            ->paginate(10);

        return OrderResource::collection($orders);
    }

    /**
     * Place an order. Scanning a table QR (`qr_token`) makes it a dine-in /
     * takeout order; without one it is an online pickup or delivery order.
     */
    public function store(Request $request, PlaceCustomerOrder $placeCustomerOrder): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();
        $isTableOrder = $request->filled('qr_token');

        $validated = $request->validate([
            'qr_token' => ['nullable', 'string', Rule::exists('tables', 'qr_token')->where('is_active', true)],
            'type' => ['required', $isTableOrder ? Rule::in(['dine-in', 'takeout']) : Rule::in(['delivery', 'pickup'])],
            'delivery_address' => ['required_if:type,delivery', 'nullable', 'string', 'max:500'],
            'delivery_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'delivery_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'payment_method' => [Rule::requiredIf(! $isTableOrder), 'nullable', Rule::in(['cod', 'gcash', 'maya'])],
            'payment_proof' => ['required_if:payment_method,gcash,maya', 'nullable', 'image', 'max:5120'],
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

        $validated['table_id'] = $isTableOrder
            ? Table::where('qr_token', $validated['qr_token'])->value('id')
            : null;

        $result = $placeCustomerOrder->handle($customer, $validated);
        $order = $result['order'];

        if ($request->hasFile('payment_proof')) {
            $order->addMediaFromRequest('payment_proof')->toMediaCollection('payment_proof');
        }

        $order->load(['table', 'items.menuItem', 'items.addons.addon']);

        // Online orders wait for the café to accept them before reaching the kitchen.
        try {
            broadcast(new OnlineOrderPlaced($order));
        } catch (\Throwable $e) {
            Log::warning('Online order broadcast failed: '.$e->getMessage());
        }

        return response()->json([
            'order' => (new OrderResource($order))->resolve(),
            'points_earned' => $result['points_earned'],
            'free_drinks_earned' => $result['free_drinks_earned'],
            'cups_awarded' => $result['cups_awarded'],
            'free_drink_redeemed' => $result['free_drink_redeemed'],
            'cup_count' => $result['cup_count'],
            'free_drinks_available' => $result['free_drinks_available'],
        ], 201);
    }

    public function show(Request $request, Order $order): OrderResource
    {
        abort_unless($order->customer_id === $request->user()->id, 404);

        return new OrderResource($order->load(['table', 'items.menuItem', 'items.addons.addon', 'payment', 'deliveryMan']));
    }

    /**
     * Customer-initiated cancellation, allowed only until the café accepts the order.
     * Earned points / cups are taken back; redeemed points and free drinks are refunded.
     */
    public function cancel(Request $request, Order $order, CancelCustomerOrder $cancelCustomerOrder): JsonResponse
    {
        abort_unless($order->customer_id === $request->user()->id, 404);

        if ($order->status !== 'pending' || ($order->isOnline() && $order->accepted_at !== null)) {
            return response()->json([
                'message' => 'The café has already accepted this order, so it can no longer be cancelled.',
            ], 422);
        }

        return response()->json([
            'order' => (new OrderResource($cancelCustomerOrder->handle($order)))->resolve(),
        ]);
    }
}
