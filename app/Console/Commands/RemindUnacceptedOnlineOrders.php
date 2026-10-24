<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OnlineOrderWaiting;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Emails admins about online orders nobody has accepted within the reminder window.
 * Each order is reminded once; the admin panel keeps nagging on screen until it's handled.
 */
#[Signature('orders:remind-unaccepted')]
#[Description('Remind admins about online orders waiting too long to be accepted')]
class RemindUnacceptedOnlineOrders extends Command
{
    public function handle(): int
    {
        $overdue = Order::awaitingAcceptance()
            ->whereNull('reminded_at')
            ->where('created_at', '<=', now()->subMinutes(Order::ACCEPTANCE_REMINDER_MINUTES))
            ->get();

        if ($overdue->isEmpty()) {
            return self::SUCCESS;
        }

        $admins = User::role('admin')->get();

        foreach ($overdue as $order) {
            Notification::send($admins, new OnlineOrderWaiting($order));
            $order->update(['reminded_at' => now()]);
        }

        $this->info("Reminded admins about {$overdue->count()} online order(s).");

        return self::SUCCESS;
    }
}
