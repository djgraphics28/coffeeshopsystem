<?php

namespace App\Http\Controllers\Admin\Cms;

use App\Http\Controllers\Controller;
use App\Models\GalleryImage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GalleryImageController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Cms/Gallery', [
            'images' => GalleryImage::query()->ordered()->get(['id', 'caption', 'is_active', 'sort_order']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:20'],
            'images.*' => ['image', 'max:4096'],
        ]);

        $nextOrder = (int) GalleryImage::max('sort_order') + 1;

        foreach ($validated['images'] as $index => $file) {
            $image = GalleryImage::create(['sort_order' => $nextOrder + $index]);
            $image->addMedia($file)->toMediaCollection('image');
        }

        return redirect()->route('admin.cms.gallery.index')->with('success', 'Photos uploaded.');
    }

    public function update(Request $request, GalleryImage $galleryImage): RedirectResponse
    {
        $galleryImage->update($request->validate([
            'caption' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]));

        return redirect()->route('admin.cms.gallery.index')->with('success', 'Photo updated.');
    }

    public function destroy(GalleryImage $galleryImage): RedirectResponse
    {
        $galleryImage->delete();

        return redirect()->route('admin.cms.gallery.index')->with('success', 'Photo deleted.');
    }
}
