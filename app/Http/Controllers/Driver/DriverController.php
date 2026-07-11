<?php

namespace App\Http\Controllers\Driver;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class DriverController extends Controller
{
    public function index(Request $request): Response
    {
        $deliveryMan = $request->user()->deliveryMan;

        $baseQuery = fn () => Order::query()
            ->where('type', 'delivery')
            ->when($deliveryMan, fn ($q) => $q->where('delivery_man_id', $deliveryMan->id), fn ($q) => $q->whereRaw('1 = 0'))
            ->with(['customer', 'items.menuItem', 'payment', 'deliveryMan']);

        return Inertia::render('Driver/Dashboard', [
            'delivery_man' => $deliveryMan ? ['id' => $deliveryMan->id, 'name' => $deliveryMan->name, 'vehicle' => $deliveryMan->vehicle] : null,
            'active_orders' => OrderResource::collection(
                $baseQuery()->whereNotIn('status', ['completed', 'cancelled', 'voided'])->oldest()->get()
            )->resolve(),
            'completed_today' => OrderResource::collection(
                $baseQuery()->where('status', 'completed')->whereDate('updated_at', today())->latest('updated_at')->get()
            )->resolve(),
            'settings' => [
                'cafe_name' => Setting::get('cafe_name', "Milk&Honey Cafe'"),
                'currency' => Setting::get('currency', '₱'),
            ],
        ]);
    }

    /**
     * Rider confirms COD cash collected from the customer.
     */
    public function collectPayment(Request $request, Order $order): RedirectResponse
    {
        $deliveryMan = $request->user()->deliveryMan;

        if (! $deliveryMan || $order->delivery_man_id !== $deliveryMan->id) {
            abort(403, 'This delivery is not assigned to you.');
        }

        if ($order->payment_method !== 'cod') {
            return redirect()->back()->with('error', 'This order was paid online — nothing to collect.');
        }

        if ($order->isPaid()) {
            return redirect()->back()->with('error', 'This order is already marked as paid.');
        }

        $order->payment()->create([
            'amount' => $order->total,
            'method' => 'cash',
            'reference_no' => 'COD — cash collected by '.$deliveryMan->name,
            'paid_at' => now(),
        ]);

        return redirect()->back()->with('success', 'Cash payment recorded.');
    }

    /**
     * Rider marks the delivery as handed to the customer.
     */
    public function markDelivered(Request $request, Order $order): RedirectResponse
    {
        $deliveryMan = $request->user()->deliveryMan;

        if (! $deliveryMan || $order->delivery_man_id !== $deliveryMan->id) {
            abort(403, 'This delivery is not assigned to you.');
        }

        if (in_array($order->status, Order::TERMINAL_STATUSES, true)) {
            return redirect()->back()->with('error', 'This order is already closed.');
        }

        if ($order->payment_method === 'cod' && ! $order->isPaid()) {
            return redirect()->back()->with('error', 'Collect the cash payment before marking as delivered.');
        }

        $order->update(['status' => 'completed']);

        try {
            $fresh = $order->fresh(['table', 'items.menuItem', 'items.addons.addon', 'deliveryMan']);
            if ($fresh) {
                broadcast(new OrderStatusUpdated($fresh))->toOthers();
            }
        } catch (\Throwable $e) {
            Log::warning('Driver broadcast failed: '.$e->getMessage());
        }

        return redirect()->back()->with('success', 'Delivered! Great job. 🎉');
    }
}
