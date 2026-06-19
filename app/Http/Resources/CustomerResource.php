<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'notes' => $this->notes,
            'points' => $this->points,
            'cup_count' => $this->cup_count,
            'free_drinks_available' => $this->free_drinks_available,
            'orders_count' => $this->whenCounted('orders'),
            'orders_sum_total' => $this->whenAggregated('orders', 'total', 'sum'),
            'orders_sum_points_earned' => $this->whenAggregated('orders', 'points_earned', 'sum'),
            'email_verified_at' => $this->email_verified_at,
            'last_order_at' => $this->whenLoaded('orders', fn () => $this->orders->first()?->created_at),
            'created_at' => $this->created_at,
        ];
    }
}
