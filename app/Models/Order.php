<?php

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    protected $fillable = [
        'table_id',
        'order_number',
        'status',
        'type',
        'subtotal',
        'tax',
        'discount',
        'total',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'subtotal' => 'float',
        'tax' => 'float',
        'discount' => 'float',
        'total' => 'float',
    ];

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    public function isPaid(): bool
    {
        return $this->payment()->exists();
    }

    public function scopeActive($query): void
    {
        $query->whereNotIn('status', ['completed', 'cancelled']);
    }

    public function scopeToday($query): void
    {
        $query->whereDate('created_at', today());
    }

    /**
     * Generate a unique daily order number in the format MH-YYMMDD-XXXX.
     * Uses MAX of today's sequence so deletions never cause collisions.
     */
    public static function generateOrderNumber(): string
    {
        $datePart = now()->format('ymd');
        $prefix = "MH-{$datePart}-";

        $last = static::where('order_number', 'like', $prefix.'%')
            ->orderByDesc('order_number')
            ->value('order_number');

        $next = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}
