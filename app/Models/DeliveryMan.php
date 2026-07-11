<?php

namespace App\Models;

use Database\Factories\DeliveryManFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeliveryMan extends Model
{
    /** @use HasFactory<DeliveryManFactory> */
    use HasFactory;

    protected $table = 'delivery_men';

    protected $fillable = [
        'name',
        'phone',
        'vehicle',
        'is_active',
        'user_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function scopeActive($query): void
    {
        $query->where('is_active', true);
    }
}
