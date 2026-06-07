<?php

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Table;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\postJson;

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
});
