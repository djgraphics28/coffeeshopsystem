<?php

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;
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

    /**
     * Preparation stations. Items flagged `is_kitchen` are cooked in the kitchen; every other item is made by the barista.
     *
     * @var list<string>
     */
    public const STATIONS = ['kitchen', 'barista'];

    /** @var list<string> */
    public const STATION_STATUSES = ['pending', 'preparing', 'ready', 'completed'];

    protected $fillable = [
        'table_id',
        'customer_id',
        'promo_id',
        'order_number',
        'status',
        'kitchen_status',
        'barista_status',
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

    /**
     * Orders containing at least one item that is prepared in the kitchen.
     */
    public function scopeHasKitchenItems($query): void
    {
        $query->whereHas('items.menuItem', fn ($menuItem) => $menuItem->where('is_kitchen', true));
    }

    /**
     * The order's items that belong to the given station ('kitchen' or 'barista').
     *
     * @return Collection<int, OrderItem>
     */
    public function stationItems(string $station): Collection
    {
        $this->loadMissing('items.menuItem');

        return $this->items->filter(
            fn (OrderItem $item) => (bool) ($item->menuItem?->is_kitchen ?? true) === ($station === 'kitchen'),
        )->values();
    }

    /**
     * Progress of a station on this order, or null when the order has nothing for that station.
     */
    public function stationStatus(string $station): ?string
    {
        if ($this->stationItems($station)->isEmpty()) {
            return null;
        }

        if (in_array($this->status, self::TERMINAL_STATUSES, true)) {
            return 'completed';
        }

        return $this->getAttribute($station.'_status') ?? $this->status;
    }

    /**
     * Records a station's progress and re-derives the order's overall status from all stations.
     */
    public function setStationStatus(string $station, string $status): void
    {
        // Pin every other station's current progress first, otherwise it would later follow the combined status.
        $attributes = [];

        foreach (self::STATIONS as $other) {
            if ($this->getAttribute($other.'_status') === null && $this->stationItems($other)->isNotEmpty()) {
                $attributes[$other.'_status'] = $this->stationStatus($other);
            }
        }

        $this->update([...$attributes, $station.'_status' => $status]);
        $this->syncOverallStatus();
    }

    /**
     * Manual overrides (admin / POS) set the overall status directly, so station progress is reset to follow it.
     */
    public function setStatusManually(string $status): void
    {
        $this->update(['status' => $status, 'kitchen_status' => null, 'barista_status' => null]);
    }

    /**
     * Overall status: "ready" once every station involved is ready, "preparing" once any has started.
     * Completing the order is always a separate, explicit step.
     */
    public function syncOverallStatus(): void
    {
        if (in_array($this->status, self::TERMINAL_STATUSES, true)) {
            return;
        }

        $statuses = collect(self::STATIONS)->map(fn (string $station) => $this->stationStatus($station))->filter()->values();

        if ($statuses->isEmpty()) {
            return;
        }

        $overall = match (true) {
            $statuses->every(fn (string $s) => in_array($s, ['ready', 'completed'], true)) => 'ready',
            $statuses->contains(fn (string $s) => $s !== 'pending') => 'preparing',
            default => 'pending',
        };

        $this->update(['status' => $overall]);
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
