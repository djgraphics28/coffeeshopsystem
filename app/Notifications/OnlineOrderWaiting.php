<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emailed to admins when an online order has waited too long for someone to accept it.
 */
class OnlineOrderWaiting extends Notification
{
    use Queueable;

    public function __construct(public Order $order) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $minutes = (int) $this->order->created_at->diffInMinutes(now());

        return (new MailMessage)
            ->subject("⏰ Online order #{$this->order->order_number} is waiting to be accepted")
            ->greeting('An online order needs attention')
            ->line("Order #{$this->order->order_number} ({$this->order->type}, ₱".number_format($this->order->total, 2).") has been waiting {$minutes} minutes for someone to accept it.")
            ->line('The customer can see it is still waiting for confirmation.')
            ->action('Review online orders', route('admin.online-orders.index'));
    }
}
