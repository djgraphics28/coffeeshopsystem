<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MenuItemResource;
use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class MenuItemController extends Controller
{
    public function index(Request $request): Response
    {
        $query = MenuItem::with(['category', 'addonGroups', 'variations'])->orderBy('sort_order')->orderBy('name');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%'.$request->input('search').'%');
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }

        if ($request->filled('availability')) {
            $query->where('is_available', $request->input('availability') === '1');
        }

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        $items = $query->get();
        $categories = Category::active()->get(['id', 'name']);
        $addonGroups = AddonGroup::orderBy('sort_order')->get(['id', 'name', 'is_required']);

        return Inertia::render('Admin/MenuItems/Index', [
            'items' => MenuItemResource::collection($items)->resolve(),
            'categories' => $categories,
            'addon_groups' => $addonGroups,
            'filters' => $request->only(['search', 'category_id', 'availability', 'featured']),
            'total_count' => MenuItem::count(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->rules());

        $addonGroupIds = $validated['addon_group_ids'] ?? [];
        $variations = $this->filledVariations($validated['variations'] ?? []);
        unset($validated['addon_group_ids'], $validated['image'], $validated['variations']);

        $validated['price'] = $this->resolveMenuItemPrice($validated['price'] ?? null, $variations);

        $item = MenuItem::create($validated);

        if ($request->hasFile('image')) {
            $item->addMediaFromRequest('image')->toMediaCollection('images');
        }

        if (! empty($addonGroupIds)) {
            $item->addonGroups()->sync($addonGroupIds);
        }

        $this->syncVariations($item, $variations);

        return redirect()->route('admin.menu-items.index')->with('success', 'Menu item created.');
    }

    public function update(Request $request, MenuItem $menuItem): RedirectResponse
    {
        $validated = $request->validate($this->rules());

        $addonGroupIds = $validated['addon_group_ids'] ?? [];
        $variations = $this->filledVariations($validated['variations'] ?? []);
        unset($validated['addon_group_ids'], $validated['image'], $validated['variations']);

        $validated['price'] = $this->resolveMenuItemPrice($validated['price'] ?? null, $variations);

        $menuItem->update($validated);

        if ($request->hasFile('image')) {
            $menuItem->clearMediaCollection('images');
            $menuItem->addMediaFromRequest('image')->toMediaCollection('images');
        }

        $menuItem->addonGroups()->sync($addonGroupIds);
        $this->syncVariations($menuItem, $variations);

        return redirect()->route('admin.menu-items.index')->with('success', 'Menu item updated.');
    }

    public function destroy(MenuItem $menuItem): RedirectResponse
    {
        $menuItem->clearMediaCollection('images');
        $menuItem->delete();

        return redirect()->route('admin.menu-items.index')->with('success', 'Menu item deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        return [
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'is_available' => ['boolean'],
            'is_featured' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:2048'],
            'addon_group_ids' => ['nullable', 'array'],
            'addon_group_ids.*' => ['exists:addon_groups,id'],
            'variations' => ['nullable', 'array'],
            'variations.*.name' => ['required_with:variations', 'string', 'max:50'],
            'variations.*.price' => ['required_with:variations', 'numeric', 'min:0'],
            'variations.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @param  array<int, array{name: string, price: float|int|string, sort_order?: int}>  $variations
     */
    private function syncVariations(MenuItem $item, array $variations): void
    {
        $item->variations()->delete();

        foreach ($variations as $index => $variation) {
            if (blank($variation['name'] ?? null)) {
                continue;
            }

            $item->variations()->create([
                'name' => $variation['name'],
                'price' => $variation['price'],
                'sort_order' => $variation['sort_order'] ?? $index,
            ]);
        }

        if (! empty($variations)) {
            $item->update([
                'price' => (float) collect($variations)->min('price'),
            ]);
        }
    }

    /**
     * @param  array<int, array{name?: string, price?: float|int|string}>  $variations
     * @return array<int, array{name: string, price: float|int|string, sort_order?: int}>
     */
    private function filledVariations(array $variations): array
    {
        return array_values(array_filter($variations, fn (array $variation) => filled($variation['name'] ?? null)));
    }

    /**
     * @param  array<int, array{name: string, price: float|int|string}>  $variations
     */
    private function resolveMenuItemPrice(?float $price, array $variations): float
    {
        if (! empty($variations)) {
            return (float) collect($variations)->min('price');
        }

        if ($price === null) {
            throw ValidationException::withMessages([
                'price' => 'Price or at least one size variation is required.',
            ]);
        }

        return (float) $price;
    }
}
