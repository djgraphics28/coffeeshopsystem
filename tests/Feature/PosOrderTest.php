<?php

use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Table;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('POS Terminal', function () {
    beforeEach(function () {
        $this->cashier = User::factory()->create();
        $this->cashier->assignRole('cashier');
        $this->category = Category::factory()->create();
        $this->item = MenuItem::factory()->create(['category_id' => $this->category->id, 'price' => 150]);
    });

    it('cashier can access the POS terminal', function () {
        actingAs($this->cashier)
            ->get(route('pos.index'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page->component('POS/PosTerminal'));
    });

    it('unauthenticated user is redirected from POS', function () {
        get(route('pos.index'))->assertRedirect();
    });

    it('cashier can place a walkin order', function () {
        $response = actingAs($this->cashier)
            ->postJson(route('pos.orders.store'), [
                'type' => 'walkin',
                'items' => [
                    ['menu_item_id' => $this->item->id, 'quantity' => 1, 'addon_ids' => []],
                ],
            ]);

        $response->assertStatus(201)->assertJsonPath('order.type', 'walkin');
        $this->assertDatabaseHas('orders', ['type' => 'walkin', 'created_by' => $this->cashier->id]);
    });

    it('cashier can process payment for an order', function () {
        $table = Table::factory()->create();
        $order = Order::factory()->create(['status' => 'ready', 'total' => 200, 'table_id' => $table->id]);

        actingAs($this->cashier)
            ->postJson(route('pos.orders.payment', $order->id), [
                'amount' => 200,
                'method' => 'cash',
            ])
            ->assertOk();

        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'method' => 'cash']);
    });
    it('requires a table for dine-in orders', function () {
        actingAs($this->cashier)
            ->postJson(route('pos.orders.store'), [
                'type' => 'dine-in',
                'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('table_id');
    });

    it('rejects a payment that is less than the order total', function () {
        $order = Order::factory()->create(['status' => 'ready', 'total' => 200]);

        actingAs($this->cashier)
            ->postJson(route('pos.orders.payment', $order->id), ['amount' => 150, 'method' => 'cash'])
            ->assertStatus(422);

        $this->assertDatabaseMissing('payments', ['order_id' => $order->id]);
    });

    it('rejects paying an order twice or paying a voided order', function () {
        $paid = Order::factory()->create(['status' => 'ready', 'total' => 100]);
        $voided = Order::factory()->create(['status' => 'voided', 'total' => 100]);

        actingAs($this->cashier)
            ->postJson(route('pos.orders.payment', $paid->id), ['amount' => 100, 'method' => 'cash'])
            ->assertOk();

        actingAs($this->cashier)
            ->postJson(route('pos.orders.payment', $paid->id), ['amount' => 100, 'method' => 'cash'])
            ->assertStatus(422);

        actingAs($this->cashier)
            ->postJson(route('pos.orders.payment', $voided->id), ['amount' => 100, 'method' => 'cash'])
            ->assertStatus(422);

        expect($paid->payment()->count())->toBe(1);
    });
    it('records the reason and user when voiding an order', function () {
        $order = Order::factory()->create(['status' => 'pending']);

        actingAs($this->cashier)
            ->postJson(route('pos.orders.void', $order->id), ['void_reason' => 'Customer left'])
            ->assertOk();

        $this->assertDatabaseHas('orders', [
            'id' => $order->id, 'status' => 'voided', 'void_reason' => 'Customer left', 'voided_by' => $this->cashier->id,
        ]);
    });
    it('includes the chosen size and add-on group on order items', function () {
        $item = MenuItem::factory()->create(['category_id' => $this->category->id]);
        $variation = $item->variations()->create(['name' => 'Large', 'price' => 200, 'sort_order' => 1]);
        $group = AddonGroup::create(['name' => 'Milk Type', 'is_required' => false, 'max_selections' => 1, 'sort_order' => 1]);
        $addon = Addon::create(['addon_group_id' => $group->id, 'name' => 'Oat Milk', 'additional_price' => 30, 'sort_order' => 1]);

        $response = actingAs($this->cashier)
            ->postJson(route('pos.orders.store'), [
                'type' => 'walkin',
                'items' => [['menu_item_id' => $item->id, 'variation_id' => $variation->id, 'quantity' => 1, 'addon_ids' => [$addon->id]]],
            ])
            ->assertStatus(201);

        $response->assertJsonPath('order.items.0.variation.name', 'Large')
            ->assertJsonPath('order.items.0.addons.0.name', 'Oat Milk')
            ->assertJsonPath('order.items.0.addons.0.group_name', $group->name)
            ->assertJsonPath('order.items.0.unit_price', 230);
    });

    it('records a payment without changing the order status', function () {
        foreach (['pending', 'preparing', 'ready'] as $status) {
            $order = Order::factory()->create(['status' => $status, 'total' => 100]);

            actingAs($this->cashier)
                ->postJson(route('pos.orders.payment', $order->id), ['amount' => 100, 'method' => 'cash'])
                ->assertOk()
                ->assertJsonPath('order.status', $status);

            expect($order->fresh()->isPaid())->toBeTrue()
                ->and($order->fresh()->status)->toBe($status);
        }
    });

    it('still lets the cashier complete a paid, ready order as a separate step', function () {
        $order = Order::factory()->create(['status' => 'ready', 'total' => 100]);
        $order->payment()->create(['amount' => 100, 'method' => 'cash', 'paid_at' => now()]);

        actingAs($this->cashier)
            ->patchJson(route('pos.orders.update-status', $order->id), ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('order.status', 'completed');
    });
});
