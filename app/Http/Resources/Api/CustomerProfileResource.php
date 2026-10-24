<?php

namespace App\Http\Resources\Api;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The signed-in customer as seen by the ordering frontend: profile, loyalty
 * balances, lifetime stats and the order currently in progress.
 */
class CustomerProfileResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $activeOrder = Order::query()
            ->where('customer_id', $this->id)
            ->active()
            ->latest()
            ->first(['id', 'order_number', 'status']);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'email_verified' => $this->hasVerifiedEmail(),
            'points' => $this->points,
            'cup_count' => $this->cup_count,
            'free_drinks_available' => $this->free_drinks_available,
            'stats' => [
                'total_orders' => $this->orders()->count(),
                'total_spent' => (float) $this->orders()->whereNotIn('status', ['cancelled', 'voided'])->sum('total'),
            ],
            'active_order' => $activeOrder ? [
                'id' => $activeOrder->id,
                'order_number' => $activeOrder->order_number,
                'status' => $activeOrder->status,
            ] : null,
        ];
    }
}
