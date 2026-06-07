<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\AddonGroup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AddonGroupController extends Controller
{
    public function index(): Response
    {
        $groups = AddonGroup::with('addons')->orderBy('sort_order')->get();

        return Inertia::render('Admin/AddonGroups/Index', [
            'groups' => $groups,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'is_required' => ['boolean'],
            'max_selections' => ['required', 'integer', 'min:1'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'addons' => ['nullable', 'array'],
            'addons.*.name' => ['required', 'string', 'max:100'],
            'addons.*.additional_price' => ['required', 'numeric'],
            'addons.*.sort_order' => ['nullable', 'integer'],
        ]);

        $addons = $validated['addons'] ?? [];
        unset($validated['addons']);

        $group = AddonGroup::create($validated);

        foreach ($addons as $index => $addonData) {
            $group->addons()->create(array_merge($addonData, ['sort_order' => $index + 1]));
        }

        return redirect()->route('admin.addon-groups.index')->with('success', 'Add-on group created.');
    }

    public function update(Request $request, AddonGroup $addonGroup): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'is_required' => ['boolean'],
            'max_selections' => ['required', 'integer', 'min:1'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'addons' => ['nullable', 'array'],
            'addons.*.id' => ['nullable', 'exists:addons,id'],
            'addons.*.name' => ['required', 'string', 'max:100'],
            'addons.*.additional_price' => ['required', 'numeric'],
            'addons.*.sort_order' => ['nullable', 'integer'],
        ]);

        $addons = $validated['addons'] ?? [];
        unset($validated['addons']);

        $addonGroup->update($validated);

        $existingIds = collect($addons)->pluck('id')->filter()->values()->toArray();
        $addonGroup->addons()->whereNotIn('id', $existingIds)->delete();

        foreach ($addons as $index => $addonData) {
            if (! empty($addonData['id'])) {
                Addon::where('id', $addonData['id'])->update([
                    'name' => $addonData['name'],
                    'additional_price' => $addonData['additional_price'],
                    'sort_order' => $addonData['sort_order'] ?? $index + 1,
                ]);
            } else {
                $addonGroup->addons()->create([
                    'name' => $addonData['name'],
                    'additional_price' => $addonData['additional_price'],
                    'sort_order' => $addonData['sort_order'] ?? $index + 1,
                ]);
            }
        }

        return redirect()->route('admin.addon-groups.index')->with('success', 'Add-on group updated.');
    }

    public function destroy(AddonGroup $addonGroup): RedirectResponse
    {
        $addonGroup->delete();

        return redirect()->route('admin.addon-groups.index')->with('success', 'Add-on group deleted.');
    }
}
