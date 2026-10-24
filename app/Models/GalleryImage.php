<?php

namespace App\Models;

use Database\Factories\GalleryImageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

/**
 * A photo in the storefront gallery (the café, drinks, events).
 */
class GalleryImage extends Model implements HasMedia
{
    /** @use HasFactory<GalleryImageFactory> */
    use HasFactory, InteractsWithMedia;

    protected $fillable = ['caption', 'is_active', 'sort_order'];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = ['image_url'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('image')
            ->singleFile()
            ->useDisk('public');
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->getFirstMediaUrl('image') ?: null;
    }

    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('sort_order')->latest('id');
    }
}
