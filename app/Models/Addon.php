<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Addon extends Model
{
    /** @use HasFactory<\Database\Factories\AddonFactory> */
    use HasFactory;

    protected $fillable = [
        'addon_group_id',
        'name',
        'additional_price',
        'sort_order',
    ];

    protected $casts = [
        'additional_price' => 'float',
        'sort_order' => 'integer',
    ];

    public function addonGroup(): BelongsTo
    {
        return $this->belongsTo(AddonGroup::class);
    }
}
