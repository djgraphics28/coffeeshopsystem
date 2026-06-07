<?php

namespace Database\Seeders;

use App\Models\Addon;
use App\Models\AddonGroup;
use Illuminate\Database\Seeder;

class AddonSeeder extends Seeder
{
    public function run(): void
    {
        $groups = [
            [
                'name' => 'Sugar Level',
                'is_required' => true,
                'max_selections' => 1,
                'sort_order' => 2,
                'addons' => [
                    ['name' => '0%', 'additional_price' => 0, 'sort_order' => 1],
                    ['name' => '25%', 'additional_price' => 0, 'sort_order' => 2],
                    ['name' => '50%', 'additional_price' => 0, 'sort_order' => 3],
                    ['name' => '75%', 'additional_price' => 0, 'sort_order' => 4],
                    ['name' => '100%', 'additional_price' => 0, 'sort_order' => 5],
                ],
            ],
            [
                'name' => 'Milk Type',
                'is_required' => false,
                'max_selections' => 1,
                'sort_order' => 3,
                'addons' => [
                    ['name' => 'Full Cream', 'additional_price' => 0, 'sort_order' => 1],
                    ['name' => 'Oat Milk', 'additional_price' => 30, 'sort_order' => 2],
                    ['name' => 'Almond Milk', 'additional_price' => 30, 'sort_order' => 3],
                    ['name' => 'Skim Milk', 'additional_price' => 0, 'sort_order' => 4],
                ],
            ],
            [
                'name' => 'Extras',
                'is_required' => false,
                'max_selections' => 5,
                'sort_order' => 4,
                'addons' => [
                    ['name' => 'Extra Shot', 'additional_price' => 30, 'sort_order' => 1],
                    ['name' => 'Whipped Cream', 'additional_price' => 20, 'sort_order' => 2],
                    ['name' => 'Pearl', 'additional_price' => 20, 'sort_order' => 3],
                ],
            ],
        ];

        foreach ($groups as $groupData) {
            $addons = $groupData['addons'];
            unset($groupData['addons']);

            $group = AddonGroup::firstOrCreate(['name' => $groupData['name']], $groupData);

            foreach ($addons as $addonData) {
                Addon::firstOrCreate(
                    ['addon_group_id' => $group->id, 'name' => $addonData['name']],
                    array_merge($addonData, ['addon_group_id' => $group->id])
                );
            }
        }
    }
}
