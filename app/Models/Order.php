<?php

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Order extends Model implements HasMedia
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory, InteractsWithMedia;

    /** @var list<string> */
    public const STATUSES = [
        'pending',
        'preparing',
        'ready',
        'completed',
        'cancelled',
        'voided',
    ];

    /** @var list<string> */
    public const TERMINAL_STATUSES = [
        'completed',
        'cancelled',
        'voided',
    ];

    protected $fillable = [
        'table_id',
        'customer_id',
        'promo_id',
        'order_number',
        'status',
        'type',
        'subtotal',
        'tax',
        'discount',
        'delivery_fee',
        'total',
        'notes',
        'void_reason',
        'voided_by',
        'created_by',
        'points_earned',
        'points_redeemed',
        'free_drink_redeemed',
        'cups_awarded',
        'delivery_address',
        'delivery_lat',
        'delivery_lng',
        'payment_method',
        'delivery_man_id',
    ];

    protected $casts = [
        'subtotal' => 'float',
        'tax' => 'float',
        'discount' => 'float',
        'delivery_fee' => 'float',
        'total' => 'float',
        'free_drink_redeemed' => 'boolean',
        'cups_awarded' => 'integer',
        'delivery_lat' => 'float',
        'delivery_lng' => 'float',
    ];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('payment_proof')
            ->singleFile()
            ->useDisk('public');
    }

    public function getPaymentProofUrlAttribute(): ?string
    {
        return $this->getFirstMediaUrl('payment_proof') ?: null;
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function promo(): BelongsTo
    {
        return $this->belongsTo(Promo::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function deliveryMan(): BelongsTo
    {
        return $this->belongsTo(DeliveryMan::class);
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
        $query->whereNotIn('status', self::TERMINAL_STATUSES);
    }

    public function isVoidable(): bool
    {
        return ! in_array($this->status, self::TERMINAL_STATUSES, true);
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
