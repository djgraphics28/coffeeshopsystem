<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status,
            'type' => $this->type,
            'subtotal' => $this->subtotal,
            'tax' => $this->tax,
            'discount' => $this->discount,
            'total' => $this->total,
            'notes' => $this->notes,
            'table' => $this->whenLoaded('table', fn () => [
                'id' => $this->table?->id,
                'name' => $this->table?->name,
                'qr_token' => $this->table?->qr_token,
            ]),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'menu_item_id' => $item->menu_item_id,
                'menu_item' => [
                    'id' => $item->menuItem?->id,
                    'name' => $item->menuItem?->name,
                    'image_url' => $item->menuItem?->image_url,
                ],
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'subtotal' => $item->subtotal,
                'notes' => $item->notes,
                'addons' => $item->relationLoaded('addons')
                    ? $item->addons->map(fn ($a) => [
                        'id' => $a->id,
                        'addon_id' => $a->addon_id,
                        'name' => $a->addon?->name,
                        'group_name' => $a->addon?->addonGroup?->name,
                        'additional_price' => $a->additional_price,
                    ])
                    : [],
            ])),
            'payment' => $this->whenLoaded('payment', fn () => $this->payment ? [
                'id' => $this->payment->id,
                'amount' => $this->payment->amount,
                'method' => $this->payment->method,
                'reference_no' => $this->payment->reference_no,
                'paid_at' => $this->payment->paid_at,
            ] : null),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
