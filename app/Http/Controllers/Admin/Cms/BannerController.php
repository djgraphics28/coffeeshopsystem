<?php

namespace App\Http\Controllers\Admin\Cms;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BannerController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Cms/Banners', [
            'banners' => Banner::query()->ordered()->get()->map(fn (Banner $banner) => [
                ...$banner->only(['id', 'title', 'subtitle', 'body', 'badge', 'theme', 'cta_label', 'cta_url', 'is_active', 'sort_order', 'image_url']),
                'starts_at' => $banner->starts_at?->format('Y-m-d\TH:i'),
                'ends_at' => $banner->ends_at?->format('Y-m-d\TH:i'),
                'is_live' => Banner::query()->live()->whereKey($banner->id)->exists(),
            ]),
            'themes' => Banner::THEMES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $banner = Banner::create($this->validated($request));
        $this->syncImage($request, $banner);

        return redirect()->route('admin.cms.banners.index')->with('success', 'Banner created.');
    }

    public function update(Request $request, Banner $banner): RedirectResponse
    {
        $banner->update($this->validated($request));
        $this->syncImage($request, $banner);

        return redirect()->route('admin.cms.banners.index')->with('success', 'Banner updated.');
    }

    public function destroy(Banner $banner): RedirectResponse
    {
        $banner->delete();

        return redirect()->route('admin.cms.banners.index')->with('success', 'Banner deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    protected function validated(Request $request): array
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:2000'],
            'badge' => ['nullable', 'string', 'max:50'],
            'theme' => ['required', Rule::in(Banner::THEMES)],
            'cta_label' => ['nullable', 'string', 'max:50', 'required_with:cta_url'],
            'cta_url' => ['nullable', 'string', 'max:255'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:4096'],
            'remove_image' => ['nullable', 'boolean'],
        ]);

        unset($validated['image'], $validated['remove_image']);
        $validated['sort_order'] ??= 0;

        return $validated;
    }

    protected function syncImage(Request $request, Banner $banner): void
    {
        if ($request->hasFile('image')) {
            $banner->addMediaFromRequest('image')->toMediaCollection('image');
        } elseif ($request->boolean('remove_image')) {
            $banner->clearMediaCollection('image');
        }
    }
}
