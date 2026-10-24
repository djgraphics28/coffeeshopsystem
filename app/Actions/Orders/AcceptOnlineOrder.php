<?php

namespace App\Actions\Orders;

use App\Events\OrderPlaced;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * The café confirms an online order: it's released to the kitchen / barista boards.
 */
class AcceptOnlineOrder
{
    public function handle(Order $order, User $staff): Order
    {
        $order->update(['accepted_at' => now(), 'accepted_by' => $staff->id]);

        $fresh = $order->fresh(['table', 'items.menuItem', 'items.addons.addon']);

        // The stations only hear about online orders once accepted.
        try {
            broadcast(new OrderPlaced($fresh));
        } catch (\Throwable $e) {
            Log::warning('Order accept broadcast failed: '.$e->getMessage());
        }

        return $fresh;
    }
}
