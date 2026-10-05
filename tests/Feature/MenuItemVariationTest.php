<?php

use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemVariation;
use App\Models\Order;
use App\Models\User;

describe('Menu Item Variations', function () {
    beforeEach(function () {
        $this->category = Category::factory()->create();
    });

    it('resolves base price from a selected variation', function () {
        $item = MenuItem::factory()->create([
            'category_id' => $this->category->id,
            'price' => 150,
        ]);

        $small = MenuItemVariation::factory()->create([
            'menu_item_id' => $item->id,
            'name' => 'Small',
            'price' => 150,
        ]);

        $large = MenuItemVariation::factory()->create([
            'menu_item_id' => $item->id,
            'name' => 'Large',
            'price' => 190,
        ]);

        expect($item->fresh()->hasVariations())->toBeTrue();
        expect($item->resolveBasePrice($small->id))->toBe(150.0);
        expect($item->resolveBasePrice($large->id))->toBe(190.0);
    });

    it('stores variation and addon totals on an order item', function () {
        $item = MenuItem::factory()->create([
            'category_id' => $this->category->id,
            'price' => 150,
        ]);

        $variation = MenuItemVariation::factory()->create([
            'menu_item_id' => $item->id,
            'name' => 'Medium',
            'price' => 180,
        ]);

        $addonGroup = AddonGroup::create([
            'name' => 'Extras',
            'is_required' => false,
            'max_selections' => 1,
            'sort_order' => 1,
        ]);

        $addon = Addon::create([
            'addon_group_id' => $addonGroup->id,
            'name' => 'Pearl',
            'additional_price' => 20,
            'sort_order' => 1,
        ]);

        $order = Order::factory()->create();
        $unitPrice = $item->resolveBasePrice($variation->id) + $addon->additional_price;

        $orderItem = $order->items()->create([
            'menu_item_id' => $item->id,
            'menu_item_variation_id' => $variation->id,
            'quantity' => 1,
            'unit_price' => $unitPrice,
            'subtotal' => $unitPrice,
        ]);

        $orderItem->addons()->create([
            'addon_id' => $addon->id,
            'additional_price' => $addon->additional_price,
        ]);

        expect((float) $orderItem->unit_price)->toBe(200.0);
        $this->assertDatabaseHas('order_items', [
            'menu_item_id' => $item->id,
            'menu_item_variation_id' => $variation->id,
            'unit_price' => 200,
        ]);
    });

    describe('admin form', function () {
        beforeEach(function () {
            $this->admin = User::factory()->create();
            $this->admin->assignRole('admin');
        });

        it('creates an item with sizes and ignores blank size rows', function () {
            \Pest\Laravel\actingAs($this->admin)
                ->post(route('admin.menu-items.store'), [
                    'category_id' => $this->category->id,
                    'name' => 'Sized Latte',
                    'is_available' => true,
                    'variations' => [
                        ['name' => 'Small', 'price' => '100', 'sort_order' => 0],
                        ['name' => '', 'price' => '', 'sort_order' => 1],
                        ['name' => 'Large', 'price' => '150', 'sort_order' => 2],
                    ],
                ])
                ->assertSessionHasNoErrors();

            $item = MenuItem::firstWhere('name', 'Sized Latte');
            expect($item->variations)->toHaveCount(2)
                ->and((float) $item->price)->toBe(100.0);
        });

        it('reports which size row is incomplete', function () {
            \Pest\Laravel\actingAs($this->admin)
                ->post(route('admin.menu-items.store'), [
                    'category_id' => $this->category->id,
                    'name' => 'Half Filled',
                    'variations' => [
                        ['name' => 'Small', 'price' => ''],
                        ['name' => '', 'price' => '120'],
                    ],
                ])
                ->assertSessionHasErrors(['variations.0.price', 'variations.1.name']);

            expect(MenuItem::where('name', 'Half Filled')->exists())->toBeFalse();
        });

        it('bulk adjusts only the chosen sizes', function () {
            $withSizes = MenuItem::factory()->create(['category_id' => $this->category->id, 'price' => 100]);
            $withSizes->variations()->create(['name' => 'Small', 'price' => 100, 'sort_order' => 0]);
            $withSizes->variations()->create(['name' => 'Large', 'price' => 150, 'sort_order' => 1]);
            $plain = MenuItem::factory()->create(['category_id' => $this->category->id, 'price' => 80]);

            \Pest\Laravel\actingAs($this->admin)
                ->post(route('admin.menu-items.bulk-price-update'), [
                    'ids' => [$withSizes->id, $plain->id],
                    'type' => 'percent_increase',
                    'value' => 10,
                    'sizes' => ['Large'],
                ])
                ->assertSessionHasNoErrors();

            expect((float) $withSizes->variations()->where('name', 'Small')->value('price'))->toBe(100.0)
                ->and((float) $withSizes->variations()->where('name', 'Large')->value('price'))->toBe(165.0)
                ->and((float) $plain->fresh()->price)->toBe(80.0)
                ->and((float) $withSizes->fresh()->price)->toBe(100.0);
        });

        it('bulk adjusts every size and plain items when no sizes are chosen', function () {
            $withSizes = MenuItem::factory()->create(['category_id' => $this->category->id, 'price' => 100]);
            $withSizes->variations()->create(['name' => 'Small', 'price' => 100, 'sort_order' => 0]);
            $plain = MenuItem::factory()->create(['category_id' => $this->category->id, 'price' => 80]);

            \Pest\Laravel\actingAs($this->admin)
                ->post(route('admin.menu-items.bulk-price-update'), [
                    'ids' => [$withSizes->id, $plain->id],
                    'type' => 'fixed_increase',
                    'value' => 10,
                    'sizes' => [],
                ])
                ->assertSessionHasNoErrors();

            expect((float) $withSizes->variations()->first()->price)->toBe(110.0)
                ->and((float) $plain->fresh()->price)->toBe(90.0);
        });

        it('saves is_kitchen from the admin form and defaults new items to the kitchen', function () {
            \Pest\Laravel\actingAs($this->admin)
                ->post(route('admin.menu-items.store'), ['category_id' => $this->category->id, 'name' => 'Bottled Tea', 'price' => 40, 'is_kitchen' => false])
                ->assertSessionHasNoErrors();

            expect(MenuItem::firstWhere('name', 'Bottled Tea')->is_kitchen)->toBeFalse()
                ->and(MenuItem::factory()->create(['category_id' => $this->category->id])->fresh()->is_kitchen)->toBeTrue();
        });

        it('filters menu items by kitchen preparation', function () {
            MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Cooked', 'is_kitchen' => true]);
            MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Packaged', 'is_kitchen' => false]);

            \Pest\Laravel\actingAs($this->admin)
                ->get(route('admin.menu-items.index', ['kitchen' => '0']))
                ->assertInertia(fn ($page) => $page->has('items', 1)->where('items.0.name', 'Packaged'));
        });
    });
});
