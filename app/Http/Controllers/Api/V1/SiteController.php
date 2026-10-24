<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use App\Models\GalleryImage;
use App\Models\Setting;
use App\Support\SiteContent;
use Illuminate\Http\JsonResponse;

class SiteController extends Controller
{
    /**
     * Everything the storefront brochure (home page) shows: site copy, live promo /
     * event banners and the photo gallery.
     */
    public function show(): JsonResponse
    {
        $banners = Banner::query()->live()->ordered()->get()->map(fn (Banner $banner) => [
            ...$banner->only(['id', 'title', 'subtitle', 'body', 'badge', 'theme', 'cta_label', 'cta_url', 'image_url']),
            'ends_at' => $banner->ends_at?->toIso8601String(),
        ]);

        $gallery = GalleryImage::query()->where('is_active', true)->ordered()->get()
            ->filter(fn (GalleryImage $image) => $image->image_url !== null)
            ->map(fn (GalleryImage $image) => $image->only(['id', 'caption', 'image_url']))
            ->values();

        return response()->json([
            'data' => [
                'content' => [
                    ...SiteContent::all(),
                    'opening_time' => Setting::get('opening_time'),
                    'closing_time' => Setting::get('closing_time'),
                ],
                'banners' => $banners,
                'gallery' => $gallery,
            ],
        ]);
    }
}
