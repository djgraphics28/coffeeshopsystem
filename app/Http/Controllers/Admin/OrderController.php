<?php

namespace App\Http\Controllers\Admin;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
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

        $query = Order::with(['table', 'items.menuItem', 'items.addons.addon', 'payment', 'customer', 'promo'])->latest();

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
            'can' => [
                'manage_orders' => Auth::user()?->can('manage orders') ?? false,
                'void_orders' => Auth::user()?->can('void orders') ?? false,
            ],
        ]);
    }

    public function show(Order $order): Response
    {
        Gate::authorize('view orders');

        $order->load(['table', 'items.menuItem', 'items.addons.addon', 'payment', 'creator', 'customer', 'promo', 'voidedBy']);

        return Inertia::render('Admin/Orders/Show', [
            'order' => (new OrderResource($order))->resolve(),
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

    private function broadcastStatusUpdate(Order $order): void
    {
        try {
            $fresh = $order->fresh(['table', 'items.menuItem', 'items.addons.addon']);
            if ($fresh) {
                broadcast(new OrderStatusUpdated($fresh))->toOthers();
            }
        } catch (\Throwable $e) {
            Log::warning('Order broadcast failed: '.$e->getMessage());
        }
    }
}
