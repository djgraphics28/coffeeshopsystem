<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromoUsage extends Model
{
    /** @var list<string> */
    protected $fillable = ['promo_id', 'customer_id', 'order_id'];

    public function promo(): BelongsTo
    {
        return $this->belongsTo(Promo::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
