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
            'void_reason' => $this->void_reason,
            'points_earned' => $this->points_earned,
            'points_redeemed' => $this->points_redeemed,
            'free_drink_redeemed' => $this->free_drink_redeemed,
            'cups_awarded' => $this->cups_awarded,
            'table' => $this->whenLoaded('table', fn () => [
                'id' => $this->table?->id,
                'name' => $this->table?->name,
                'qr_token' => $this->table?->qr_token,
            ]),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'email' => $this->customer->email,
                'phone' => $this->customer->phone,
            ] : null),
            'promo' => $this->whenLoaded('promo', fn () => $this->promo ? [
                'id' => $this->promo->id,
                'code' => $this->promo->code,
                'name' => $this->promo->name,
            ] : null),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null),
            'voided_by' => $this->whenLoaded('voidedBy', fn () => $this->voidedBy ? [
                'id' => $this->voidedBy->id,
                'name' => $this->voidedBy->name,
            ] : null),
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
