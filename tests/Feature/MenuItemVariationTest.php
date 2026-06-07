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
});
