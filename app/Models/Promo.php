<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Promo extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'code', 'name', 'description', 'type', 'value',
        'min_order_amount', 'max_uses', 'uses_count',
        'per_customer_limit', 'expires_at', 'is_active',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'value' => 'float',
        'min_order_amount' => 'float',
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function usages(): HasMany
    {
        return $this->hasMany(PromoUsage::class);
    }

    public function isValid(float $orderSubtotal, ?int $customerId = null): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        if ($orderSubtotal < $this->min_order_amount) {
            return false;
        }

        if ($this->max_uses !== null && $this->uses_count >= $this->max_uses) {
            return false;
        }

        if ($customerId !== null && $this->per_customer_limit !== null) {
            $customerUsages = $this->usages()->where('customer_id', $customerId)->count();
            if ($customerUsages >= $this->per_customer_limit) {
                return false;
            }
        }

        return true;
    }

    public function calculateDiscount(float $subtotal): float
    {
        if ($this->type === 'percentage') {
            return round($subtotal * ($this->value / 100), 2);
        }

        return min((float) $this->value, $subtotal);
    }

    public function invalidReason(float $orderSubtotal, ?int $customerId = null): string
    {
        if (! $this->is_active) {
            return 'This promo code is no longer active.';
        }
        if ($this->expires_at && $this->expires_at->isPast()) {
            return 'This promo code has expired.';
        }
        if ($orderSubtotal < $this->min_order_amount) {
            return "Minimum order of {$this->min_order_amount} required.";
        }
        if ($this->max_uses !== null && $this->uses_count >= $this->max_uses) {
            return 'This promo code has reached its usage limit.';
        }
        if ($customerId !== null && $this->per_customer_limit !== null) {
            $used = $this->usages()->where('customer_id', $customerId)->count();
            if ($used >= $this->per_customer_limit) {
                return 'You have already used this promo code the maximum number of times.';
            }
        }

        return 'This promo code is invalid.';
    }
}
