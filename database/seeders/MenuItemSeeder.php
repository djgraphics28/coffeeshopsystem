<?php

namespace Database\Seeders;

use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Database\Seeder;

class MenuItemSeeder extends Seeder
{
    public function run(): void
    {
        $sugarGroup = AddonGroup::where('name', 'Sugar Level')->first();
        $milkGroup = AddonGroup::where('name', 'Milk Type')->first();
        $extrasGroup = AddonGroup::where('name', 'Extras')->first();

        $espresso = Category::where('name', 'Espresso Classics')->first();
        $coldBrew = Category::where('name', 'Cold Brews')->first();
        $milkTea = Category::where('name', 'Milk Teas')->first();
        $refreshers = Category::where('name', 'Refreshers')->first();
        $breakfast = Category::where('name', 'All-Day Breakfast')->first();
        $pastries = Category::where('name', 'Pastries & Bites')->first();

        $items = [
            [
                'category' => $espresso,
                'data' => ['name' => 'Honey Latte', 'description' => 'Our signature espresso with local wildflower honey, steamed milk, and a delicate honey drizzle.', 'price' => 180, 'is_featured' => true, 'sort_order' => 1],
                'groups' => [$sugarGroup, $milkGroup, $extrasGroup],
            ],
            [
                'category' => $espresso,
                'data' => ['name' => 'Cafe Americano', 'description' => 'Classic espresso shots with hot water for a bold, clean cup.', 'price' => 140, 'is_featured' => false, 'sort_order' => 2],
                'groups' => [],
            ],
            [
                'category' => $espresso,
                'data' => ['name' => 'Cappuccino', 'description' => 'Equal parts espresso, steamed milk, and silky microfoam, topped with a dusting of cocoa.', 'price' => 160, 'is_featured' => false, 'sort_order' => 3],
                'groups' => [$milkGroup, $extrasGroup],
            ],
            [
                'category' => $espresso,
                'data' => ['name' => 'Caramel Macchiato', 'description' => 'Vanilla-infused steamed milk marked with espresso and drizzled with caramel.', 'price' => 190, 'is_featured' => true, 'sort_order' => 4],
                'groups' => [$sugarGroup, $milkGroup],
            ],
            [
                'category' => $coldBrew,
                'data' => ['name' => 'Brown Sugar Oat Milk Espresso', 'description' => 'Espresso shaken with brown sugar syrup over ice, topped with creamy oat milk.', 'price' => 210, 'is_featured' => true, 'sort_order' => 1],
                'groups' => [$sugarGroup, $extrasGroup],
            ],
            [
                'category' => $coldBrew,
                'data' => ['name' => 'Classic Cold Brew', 'description' => 'Slow-steeped for 18 hours. Smooth, low-acid, and richly concentrated.', 'price' => 170, 'is_featured' => false, 'sort_order' => 2],
                'groups' => [],
            ],
            [
                'category' => $milkTea,
                'data' => ['name' => 'Signature Milk Tea', 'description' => "Our house blend of black tea with creamy milk and sweet pearls — the cafe's bestseller.", 'price' => 160, 'is_featured' => true, 'sort_order' => 1],
                'groups' => [$sugarGroup, $extrasGroup],
            ],
            [
                'category' => $milkTea,
                'data' => ['name' => 'Taro Milk Tea', 'description' => 'Earthy taro with a sweet, creamy finish. A crowd favourite.', 'price' => 175, 'is_featured' => false, 'sort_order' => 2],
                'groups' => [$sugarGroup, $extrasGroup],
            ],
            [
                'category' => $refreshers,
                'data' => ['name' => 'Strawberry Matcha Latte', 'description' => 'Vibrant layers of ceremonial-grade matcha, milk, and fresh strawberry purée.', 'price' => 195, 'is_featured' => true, 'sort_order' => 1],
                'groups' => [$milkGroup],
            ],
            [
                'category' => $refreshers,
                'data' => ['name' => 'Honey Citrus Mint Tea', 'description' => 'Refreshing blend of lemon, mint, and honey. Served chilled.', 'price' => 150, 'is_featured' => false, 'sort_order' => 2],
                'groups' => [$sugarGroup],
            ],
            [
                'category' => $breakfast,
                'data' => ['name' => 'Avocado Toast', 'description' => 'Sourdough toast topped with smashed avocado, cherry tomatoes, microgreens, and a drizzle of olive oil.', 'price' => 220, 'is_featured' => true, 'sort_order' => 1],
                'groups' => [],
            ],
            [
                'category' => $breakfast,
                'data' => ['name' => 'Eggs Benedict', 'description' => 'Poached eggs on toasted English muffin with Canadian bacon and hollandaise sauce.', 'price' => 265, 'is_featured' => false, 'sort_order' => 2],
                'groups' => [],
            ],
            [
                'category' => $pastries,
                'data' => ['name' => 'Butter Croissant', 'description' => 'Flaky, golden, buttery layers — freshly baked each morning.', 'price' => 120, 'is_featured' => false, 'sort_order' => 1],
                'groups' => [],
            ],
            [
                'category' => $pastries,
                'data' => ['name' => 'Honey Walnut Tart', 'description' => 'Shortcrust pastry filled with caramelised walnuts and local honey. Our signature sweet bite.', 'price' => 145, 'is_featured' => true, 'sort_order' => 2],
                'groups' => [],
            ],
            [
                'category' => $pastries,
                'data' => ['name' => 'Banana Bread Loaf', 'description' => 'Moist, dense, and sweetened with ripe bananas and a hint of cinnamon.', 'price' => 130, 'is_featured' => false, 'sort_order' => 3],
                'groups' => [],
            ],
        ];

        foreach ($items as $item) {
            if (! $item['category']) {
                continue;
            }

            $menuItem = MenuItem::firstOrCreate(
                ['name' => $item['data']['name']],
                array_merge($item['data'], ['category_id' => $item['category']->id, 'is_available' => true])
            );

            if (! empty($item['groups'])) {
                $groupIds = collect($item['groups'])->filter()->pluck('id')->toArray();
                $menuItem->addonGroups()->syncWithoutDetaching($groupIds);
            }
        }
    }
}
