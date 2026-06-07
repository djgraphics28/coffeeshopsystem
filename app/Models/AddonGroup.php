<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AddonGroup extends Model
{
    /** @use HasFactory<\Database\Factories\AddonGroupFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'is_required',
        'max_selections',
        'sort_order',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'max_selections' => 'integer',
        'sort_order' => 'integer',
    ];

    public function addons(): HasMany
    {
        return $this->hasMany(Addon::class)->orderBy('sort_order');
    }

    public function menuItems(): BelongsToMany
    {
        return $this->belongsToMany(MenuItem::class, 'menu_item_addon_groups')
            ->withTimestamps();
    }

    public function isMultiSelect(): bool
    {
        return $this->max_selections > 1;
    }
}
