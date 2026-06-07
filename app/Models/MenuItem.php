<?php

namespace App\Models;

use Database\Factories\MenuItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MenuItem extends Model implements HasMedia
{
    /** @use HasFactory<MenuItemFactory> */
    use HasFactory, InteractsWithMedia;

    protected $fillable = [
        'category_id',
        'name',
        'description',
        'price',
        'is_available',
        'is_featured',
        'sort_order',
    ];

    protected $casts = [
        'price' => 'float',
        'is_available' => 'boolean',
        'is_featured' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = ['image_url'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('images')
            ->singleFile()
            ->useDisk('public');
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->width(200)
            ->height(200)
            ->nonQueued();
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->getFirstMediaUrl('images') ?: null;
    }

    public function getThumbUrlAttribute(): ?string
    {
        return $this->getFirstMediaUrl('images', 'thumb') ?: null;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variations(): HasMany
    {
        return $this->hasMany(MenuItemVariation::class)->orderBy('sort_order');
    }

    public function addonGroups(): BelongsToMany
    {
        return $this->belongsToMany(AddonGroup::class, 'menu_item_addon_groups')
            ->withTimestamps()
            ->orderBy('sort_order');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function scopeAvailable($query): void
    {
        $query->where('is_available', true);
    }

    public function scopeFeatured($query): void
    {
        $query->where('is_featured', true);
    }

    public function hasVariations(): bool
    {
        if ($this->relationLoaded('variations')) {
            return $this->variations->isNotEmpty();
        }

        return $this->variations()->exists();
    }

    public function resolveBasePrice(?int $variationId = null): float
    {
        if ($variationId) {
            $variation = $this->relationLoaded('variations')
                ? $this->variations->firstWhere('id', $variationId)
                : $this->variations()->where('id', $variationId)->first();

            if ($variation) {
                return (float) $variation->price;
            }
        }

        return (float) $this->price;
    }
}
