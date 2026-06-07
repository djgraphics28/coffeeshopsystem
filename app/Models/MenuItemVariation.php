<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MenuItemVariation extends Model
{
    /** @use HasFactory<\Database\Factories\MenuItemVariationFactory> */
    use HasFactory;

    protected $fillable = [
        'menu_item_id',
        'name',
        'price',
        'sort_order',
    ];

    protected $casts = [
        'price' => 'float',
        'sort_order' => 'integer',
    ];

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }
}
