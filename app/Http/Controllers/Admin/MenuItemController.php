<?php

namespace App\Http\Controllers\Admin;

use App\Actions\MenuItems\BuildMenuItemImportTemplate;
use App\Actions\MenuItems\ImportMenuItems;
use App\Http\Controllers\Controller;
use App\Http\Resources\MenuItemResource;
use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

        if ($request->filled('kitchen')) {
            $query->where('is_kitchen', $request->input('kitchen') === '1');
        }

        if ($request->boolean('featured')) {
            $query->where('is_featured', true);
        }

        $items = $query->get();
        $categories = Category::active()->get(['id', 'name']);
        $addonGroups = AddonGroup::orderBy('sort_order')->get(['id', 'name', 'is_required']);

        $totalCount = MenuItem::count();
        $availableCount = MenuItem::where('is_available', true)->count();
        $featuredCount = MenuItem::where('is_featured', true)->count();
        $categoryCount = Category::active()->count();

        return Inertia::render('Admin/MenuItems/Index', [
            'items' => MenuItemResource::collection($items)->resolve(),
            'categories' => $categories,
            'addon_groups' => $addonGroups,
            'filters' => $request->only(['search', 'category_id', 'availability', 'featured', 'kitchen']),
            'stats' => [
                'total' => $totalCount,
                'available' => $availableCount,
                'unavailable' => $totalCount - $availableCount,
                'featured' => $featuredCount,
                'categories' => $categoryCount,
            ],
            'can' => [
                'manage_menu_items' => Auth::user()?->can('manage menu items') ?? false,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manage menu items');

        $this->dropBlankVariationRows($request);
        $validated = $request->validate($this->rules(), $this->messages());

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

        return redirect()->back()->with('success', 'Menu item created.');
    }

    public function update(Request $request, MenuItem $menuItem): RedirectResponse
    {
        Gate::authorize('manage menu items');

        $this->dropBlankVariationRows($request);
        $validated = $request->validate($this->rules(), $this->messages());

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

        return redirect()->back()->with('success', 'Menu item updated.');
    }

    public function importTemplate(BuildMenuItemImportTemplate $template): StreamedResponse
    {
        Gate::authorize('manage menu items');

        return response()->streamDownload(function () use ($template) {
            $spreadsheet = $template->handle();
            IOFactory::createWriter($spreadsheet, 'Xlsx')->save('php://output');
            $spreadsheet->disconnectWorksheets();
        }, 'menu-items-import-template.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /**
     * Validates and imports a menu spreadsheet. With `dry_run` it only reports what would happen.
     */
    public function import(Request $request, ImportMenuItems $importer): JsonResponse
    {
        Gate::authorize('manage menu items');

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120'],
            'duplicate_mode' => ['required', Rule::in([ImportMenuItems::MODE_SKIP, ImportMenuItems::MODE_UPDATE])],
            'dry_run' => ['nullable', 'boolean'],
        ], [
            'file.required' => 'Please choose an Excel file to upload.',
            'file.mimes' => 'The file must be an Excel (.xlsx, .xls) or .csv file.',
            'file.max' => 'The file is too large (maximum 5 MB).',
        ]);

        $report = $importer->handle(
            $request->file('file')->getRealPath(),
            $validated['duplicate_mode'],
            $request->boolean('dry_run'),
        );

        return response()->json($report);
    }

    public function destroy(MenuItem $menuItem): RedirectResponse
    {
        Gate::authorize('manage menu items');

        $menuItem->clearMediaCollection('images');
        $menuItem->delete();

        return redirect()->back()->with('success', 'Menu item deleted.');
    }

    public function toggleAvailability(MenuItem $menuItem): JsonResponse
    {
        Gate::authorize('manage menu items');

        $menuItem->update(['is_available' => ! $menuItem->is_available]);

        return response()->json(['is_available' => $menuItem->is_available]);
    }

    public function bulkUpdatePrices(Request $request): RedirectResponse
    {
        Gate::authorize('manage menu items');

        $type = $request->input('type');
        $updatedCount = 0;

        if ($type === 'per_variation') {
            $validated = $request->validate([
                'ids' => ['required', 'array', 'min:1'],
                'ids.*' => ['integer', 'exists:menu_items,id'],
                'type' => ['required', 'in:per_variation'],
                'prices' => ['required', 'array', 'min:1'],
                'prices.*' => ['numeric', 'min:0.01'],
            ]);

            $items = MenuItem::with('variations')->whereIn('id', $validated['ids'])->get();

            foreach ($items as $item) {
                foreach ($item->variations as $variation) {
                    if (isset($validated['prices'][$variation->name])) {
                        $variation->update(['price' => round((float) $validated['prices'][$variation->name], 2)]);
                    }
                }
                if ($item->variations->isNotEmpty()) {
                    $item->update(['price' => (float) $item->variations()->min('price')]);
                    $updatedCount++;
                }
            }
        } else {
            $validated = $request->validate([
                'ids' => ['required', 'array', 'min:1'],
                'ids.*' => ['integer', 'exists:menu_items,id'],
                'type' => ['required', 'in:percent_increase,percent_decrease,fixed_increase,fixed_decrease'],
                'value' => ['required', 'numeric', 'min:0'],
                'sizes' => ['nullable', 'array'],
                'sizes.*' => ['string', 'max:50'],
            ]);

            // When sizes are chosen, only those sizes change; items without sizes are left alone.
            $onlySizes = $validated['sizes'] ?? [];
            $items = MenuItem::with('variations')->whereIn('id', $validated['ids'])->get();

            foreach ($items as $item) {
                if ($item->variations->isNotEmpty()) {
                    $changed = false;

                    foreach ($item->variations as $variation) {
                        if ($onlySizes !== [] && ! in_array($variation->name, $onlySizes, true)) {
                            continue;
                        }

                        $variation->update(['price' => $this->applyPriceAdjustment((float) $variation->price, $validated['type'], (float) $validated['value'])]);
                        $changed = true;
                    }

                    if ($changed) {
                        $updatedCount++;
                        $item->update(['price' => (float) $item->variations()->min('price')]);
                    }
                } elseif ($onlySizes === []) {
                    $item->update(['price' => $this->applyPriceAdjustment((float) $item->price, $validated['type'], (float) $validated['value'])]);
                    $updatedCount++;
                }
            }
        }

        return redirect()->back()->with('success', $updatedCount.' item(s) prices updated.');
    }

    private function applyPriceAdjustment(float $price, string $type, float $value): float
    {
        return match ($type) {
            'percent_increase' => round($price * (1 + $value / 100), 2),
            'percent_decrease' => round(max(0, $price * (1 - $value / 100)), 2),
            'fixed_increase' => round($price + $value, 2),
            'fixed_decrease' => round(max(0, $price - $value), 2),
        };
    }

    /**
     * Size rows the cashier added but never filled in (no name and no price) are ignored rather than rejected.
     */
    private function dropBlankVariationRows(Request $request): void
    {
        $rows = $request->input('variations');

        if (! is_array($rows)) {
            return;
        }

        $request->merge([
            'variations' => array_values(array_filter(
                $rows,
                fn ($row) => is_array($row) && (filled($row['name'] ?? null) || filled($row['price'] ?? null)),
            )),
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function messages(): array
    {
        return [
            'variations.*.name.required_with' => 'Enter a name for this size (e.g. Small).',
            'variations.*.name.required' => 'Enter a name for this size (e.g. Small).',
            'variations.*.price.required_with' => 'Enter a price for this size.',
            'variations.*.price.required' => 'Enter a price for this size.',
            'variations.*.price.numeric' => 'The size price must be a number.',
        ];
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
            'is_kitchen' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:2048'],
            'addon_group_ids' => ['nullable', 'array'],
            'addon_group_ids.*' => ['exists:addon_groups,id'],
            'variations' => ['nullable', 'array'],
            'variations.*.name' => ['required', 'string', 'max:50'],
            'variations.*.price' => ['required', 'numeric', 'min:0'],
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
