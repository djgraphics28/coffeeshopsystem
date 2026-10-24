<?php

namespace App\Actions\Orders;

use App\Events\OrderStatusUpdated;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Cancels a customer's online order — by the customer, or declined by the café — and
 * reverses its loyalty effects: earned points / cups are taken back, redeemed points and
 * free drinks are refunded.
 */
class CancelCustomerOrder
{
    public function handle(Order $order, ?string $declineReason = null): Order
    {
        DB::transaction(function () use ($order, $declineReason) {
            $customer = $order->customer()->lockForUpdate()->first();

            if ($customer) {
                if ($order->points_earned > 0) {
                    $customer->decrement('points', min($order->points_earned, $customer->points));
                }

                if ($order->points_redeemed > 0) {
                    $customer->increment('points', $order->points_redeemed);
                }

                if ($order->free_drink_redeemed) {
                    $customer->increment('free_drinks_available');
                }

                if ($order->cups_awarded > 0) {
                    $customer->refresh();
                    $customer->update(['cup_count' => max(0, $customer->cup_count - $order->cups_awarded)]);
                }
            }

            $order->update(['status' => 'cancelled', 'decline_reason' => $declineReason]);
        });

        $fresh = $order->fresh(['table', 'items.menuItem', 'items.addons.addon']);

        try {
            broadcast(new OrderStatusUpdated($fresh))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('Order cancel broadcast failed: '.$e->getMessage());
        }

        return $fresh;
    }
}
