<?php

namespace App\Http\Controllers\Admin;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\DeliveryMan;
use App\Models\Order;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('view orders');

        $query = Order::with(['table', 'items.menuItem', 'items.addons.addon', 'payment', 'customer', 'promo', 'deliveryMan'])->latest();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhereHas('table', fn ($t) => $t->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('payment')) {
            $request->input('payment') === 'paid'
                ? $query->has('payment')
                : $query->doesntHave('payment');
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $orders = $query->paginate(25)->withQueryString();

        $today = Order::whereDate('created_at', today());

        return Inertia::render('Admin/Orders/Index', [
            'orders' => OrderResource::collection($orders),
            'filters' => $request->only(['search', 'status', 'date_from', 'date_to', 'type', 'payment']),
            'stats' => [
                'today_count' => (clone $today)->count(),
                'today_revenue' => (clone $today)->whereIn('status', ['completed'])->sum('total'),
                'pending' => Order::where('status', 'pending')->count(),
                'active' => Order::whereIn('status', ['preparing', 'ready'])->count(),
            ],
            'delivery_men' => DeliveryMan::active()->orderBy('name')->get(['id', 'name', 'phone', 'vehicle']),
            'can' => [
                'manage_orders' => Auth::user()?->can('manage orders') ?? false,
                'void_orders' => Auth::user()?->can('void orders') ?? false,
            ],
        ]);
    }

    public function show(Order $order): Response
    {
        Gate::authorize('view orders');

        $order->load(['table', 'items.menuItem', 'items.addons.addon', 'payment', 'creator', 'customer', 'promo', 'voidedBy', 'deliveryMan']);

        return Inertia::render('Admin/Orders/Show', [
            'order' => (new OrderResource($order))->resolve(),
            'delivery_men' => DeliveryMan::active()->orderBy('name')->get(['id', 'name', 'phone', 'vehicle']),
            'can' => [
                'manage_orders' => Auth::user()?->can('manage orders') ?? false,
                'void_orders' => Auth::user()?->can('void orders') ?? false,
            ],
        ]);
    }

    public function updateStatus(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('manage orders');

        $validated = $request->validate([
            'status' => ['required', Rule::in(Order::STATUSES)],
        ]);

        $order->update(['status' => $validated['status']]);
        $this->broadcastStatusUpdate($order);

        return redirect()->back()->with('success', 'Order status updated.');
    }

    public function void(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('void orders');

        if (! $order->isVoidable()) {
            return redirect()->back()->with('error', 'This order cannot be voided.');
        }

        $validated = $request->validate([
            'void_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $order->update([
            'status' => 'voided',
            'void_reason' => $validated['void_reason'] ?? null,
            'voided_by' => Auth::id(),
        ]);

        $this->broadcastStatusUpdate($order);

        return redirect()->back()->with('success', "Order {$order->order_number} voided.");
    }

    /**
     * Verify and record payment for an online order.
     * GCash/Maya: admin reviews the uploaded proof and approves it.
     * COD: cash is verified by the assigned delivery man on handoff, so a
     * delivery order must have a rider assigned before it can be marked paid.
     */
    public function markPaid(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('manage orders');

        if ($order->isPaid()) {
            return redirect()->back()->with('error', 'This order is already marked as paid.');
        }

        if (! $order->payment_method) {
            return redirect()->back()->with('error', 'This order has no online payment method to verify.');
        }

        if ($order->payment_method === 'cod' && $order->type === 'delivery' && ! $order->delivery_man_id) {
            return redirect()->back()->with('error', 'Assign a delivery man first — the rider verifies the cash payment on handoff.');
        }

        $validated = $request->validate([
            'reference_no' => ['nullable', 'string', 'max:255'],
        ]);

        $order->load('deliveryMan');

        $reference = $validated['reference_no'] ?? null;

        if ($order->payment_method === 'cod') {
            $reference = $order->type === 'delivery'
                ? 'COD — cash collected by '.$order->deliveryMan->name
                : 'COD — cash collected at counter';
        }

        $order->payment()->create([
            'amount' => $order->total,
            'method' => $order->payment_method === 'cod' ? 'cash' : $order->payment_method,
            'reference_no' => $reference,
            'paid_at' => now(),
        ]);

        $label = $order->payment_method === 'cod' ? 'Cash payment confirmed.' : strtoupper($order->payment_method).' payment approved and marked as paid.';

        return redirect()->back()->with('success', $label);
    }

    public function assignDeliveryMan(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('manage orders');

        if ($order->type !== 'delivery') {
            return redirect()->back()->with('error', 'Only delivery orders can be assigned a delivery man.');
        }

        $validated = $request->validate([
            'delivery_man_id' => ['nullable', 'exists:delivery_men,id'],
        ]);

        $order->update(['delivery_man_id' => $validated['delivery_man_id'] ?? null]);
        $this->broadcastStatusUpdate($order);

        return redirect()->back()->with('success', $validated['delivery_man_id'] ? 'Delivery man assigned.' : 'Delivery man unassigned.');
    }

    private function broadcastStatusUpdate(Order $order): void
    {
        try {
            $fresh = $order->fresh(['table', 'items.menuItem', 'items.addons.addon', 'deliveryMan']);
            if ($fresh) {
                broadcast(new OrderStatusUpdated($fresh))->toOthers();
            }
        } catch (\Throwable $e) {
            Log::warning('Order broadcast failed: '.$e->getMessage());
        }
    }
}
