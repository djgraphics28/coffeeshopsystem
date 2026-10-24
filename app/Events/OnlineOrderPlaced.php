<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Alerts the admin panel that an online order is waiting to be accepted. The payload
 * is deliberately minimal (the channel is public); staff load full details from the panel.
 */
class OnlineOrderPlaced implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Order $order) {}

    public function broadcastOn(): array
    {
        return [new Channel('online-orders')];
    }

    public function broadcastAs(): string
    {
        return 'online-order.placed';
    }

    public function broadcastWith(): array
    {
        return ['id' => $this->order->id, 'order_number' => $this->order->order_number];
    }
}
