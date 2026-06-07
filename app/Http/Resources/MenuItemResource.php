<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MenuItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $hasVariations = $this->relationLoaded('variations') && $this->variations->isNotEmpty();

        $addonGroups = $this->whenLoaded('addonGroups', function () use ($hasVariations) {
            $groups = $this->addonGroups;

            if ($hasVariations) {
                $groups = $groups->filter(fn ($group) => strtolower($group->name) !== 'size');
            }

            return $groups->map(fn ($group) => [
                'id' => $group->id,
                'name' => $group->name,
                'is_required' => $group->is_required,
                'max_selections' => $group->max_selections,
                'addons' => $group->addons->map(fn ($addon) => [
                    'id' => $addon->id,
                    'name' => $addon->name,
                    'additional_price' => $addon->additional_price,
                ]),
            ])->values();
        });

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'display_price' => $hasVariations ? (float) $this->variations->min('price') : (float) $this->price,
            'has_variations' => $hasVariations,
            'image_url' => $this->image_url,
            'is_available' => $this->is_available,
            'is_featured' => $this->is_featured,
            'sort_order' => $this->sort_order,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'icon' => $this->category->icon,
            ]),
            'variations' => $this->whenLoaded('variations', fn () => $this->variations->map(fn ($variation) => [
                'id' => $variation->id,
                'name' => $variation->name,
                'price' => $variation->price,
                'sort_order' => $variation->sort_order,
            ])),
            'addon_groups' => $addonGroups,
        ];
    }
}
