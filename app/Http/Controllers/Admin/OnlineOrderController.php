<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Orders\AcceptOnlineOrder;
use App\Actions\Orders\CancelCustomerOrder;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Orders placed on the online storefront, kept apart from POS orders. New ones wait
 * here until staff accept (sending them to the kitchen / barista) or decline them.
 */
class OnlineOrderController extends Controller
{
    private const RELATIONS = ['table', 'customer', 'items.menuItem', 'items.addons.addon', 'payment', 'deliveryMan', 'acceptedBy'];

    public function index(): Response
    {
        Gate::authorize('view orders');

        $waiting = Order::awaitingAcceptance()->with(self::RELATIONS)->oldest()->get();

        $inProgress = Order::online()->active()->whereNotNull('accepted_at')->with(self::RELATIONS)->oldest()->get();

        $recent = Order::online()
            ->whereIn('status', Order::TERMINAL_STATUSES)
            ->whereDate('updated_at', today())
            ->with(self::RELATIONS)
            ->latest('updated_at')
            ->limit(30)
            ->get();

        return Inertia::render('Admin/OnlineOrders/Index', [
            'waiting' => OrderResource::collection($waiting)->resolve(),
            'inProgress' => OrderResource::collection($inProgress)->resolve(),
            'recent' => OrderResource::collection($recent)->resolve(),
            'reminderMinutes' => Order::ACCEPTANCE_REMINDER_MINUTES,
        ]);
    }

    /**
     * Lightweight list of orders waiting for acceptance — polled by every admin page
     * to raise new-order alerts and 5-minute reminders.
     */
    public function pulse(): JsonResponse
    {
        Gate::authorize('view orders');

        $waiting = Order::awaitingAcceptance()->with('customer:id,name')->oldest()->get();

        return response()->json([
            'reminder_minutes' => Order::ACCEPTANCE_REMINDER_MINUTES,
            'server_time' => now()->toIso8601String(),
            'waiting' => $waiting->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'type' => $order->type,
                'total' => $order->total,
                'customer' => $order->customer?->name,
                'created_at' => $order->created_at->toIso8601String(),
                'waiting_minutes' => (int) $order->created_at->diffInMinutes(now()),
            ]),
        ]);
    }

    public function accept(Request $request, Order $order, AcceptOnlineOrder $acceptOnlineOrder): RedirectResponse
    {
        Gate::authorize('manage orders');

        if (! $order->isAwaitingAcceptance()) {
            return back()->with('error', "Order #{$order->order_number} is no longer waiting for acceptance.");
        }

        $acceptOnlineOrder->handle($order, $request->user());

        return back()->with('success', "Order #{$order->order_number} accepted — sent to the kitchen.");
    }

    public function decline(Request $request, Order $order, CancelCustomerOrder $cancelCustomerOrder): RedirectResponse
    {
        Gate::authorize('manage orders');

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        if (! $order->isAwaitingAcceptance()) {
            return back()->with('error', "Order #{$order->order_number} is no longer waiting for acceptance.");
        }

        $cancelCustomerOrder->handle($order, $validated['reason']);

        return back()->with('success', "Order #{$order->order_number} declined.");
    }
}
