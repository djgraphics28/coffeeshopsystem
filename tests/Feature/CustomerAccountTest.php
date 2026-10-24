<?php

use App\Models\Customer;
use App\Models\Order;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

describe('Customer Account API', function () {
    beforeEach(function () {
        $this->customer = Customer::factory()->create();
    });

    it('lists order history for the signed-in customer only', function () {
        $mine = Order::factory()->create(['customer_id' => $this->customer->id]);
        Order::factory()->create(['customer_id' => Customer::factory()->create()->id]);

        Sanctum::actingAs($this->customer);

        getJson(route('api.v1.orders.index'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', $mine->order_number)
            ->assertJsonPath('meta.total', 1);
    });

    it('shows a single order to its owner', function () {
        $order = Order::factory()->create(['customer_id' => $this->customer->id]);
        Sanctum::actingAs($this->customer);

        getJson(route('api.v1.orders.show', $order))
            ->assertOk()
            ->assertJsonPath('data.id', $order->id);
    });

    it("hides another customer's order", function () {
        $order = Order::factory()->create(['customer_id' => Customer::factory()->create()->id]);
        Sanctum::actingAs($this->customer);

        getJson(route('api.v1.orders.show', $order))->assertNotFound();
    });

    it('returns the profile with stats and the active order', function () {
        Order::factory()->create(['customer_id' => $this->customer->id, 'total' => 250, 'status' => 'completed']);
        $active = Order::factory()->create(['customer_id' => $this->customer->id, 'status' => 'preparing']);

        Sanctum::actingAs($this->customer);

        getJson(route('api.v1.me'))
            ->assertOk()
            ->assertJsonPath('data.stats.total_orders', 2)
            ->assertJsonPath('data.active_order.id', $active->id)
            ->assertJsonPath('data.active_order.status', 'preparing');
    });

    it('updates the profile name and phone', function () {
        Sanctum::actingAs($this->customer);

        putJson(route('api.v1.me.update'), ['name' => 'New Name', 'phone' => '09170001111'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        expect($this->customer->fresh()->phone)->toBe('09170001111');
    });

    it('rejects guests', function () {
        getJson(route('api.v1.orders.index'))->assertUnauthorized();
        getJson(route('api.v1.me'))->assertUnauthorized();
    });
});

describe('Customer Order Cancellation', function () {
    beforeEach(function () {
        $this->customer = Customer::factory()->create();
        Sanctum::actingAs($this->customer);
    });

    it('lets a customer cancel their pending order and refunds loyalty', function () {
        $this->customer->update(['points' => 100]);
        $order = Order::factory()->create([
            'customer_id' => $this->customer->id,
            'status' => 'pending',
            'points_earned' => 50,
            'points_redeemed' => 20,
        ]);

        postJson(route('api.v1.orders.cancel', $order))
            ->assertOk()
            ->assertJsonPath('order.status', 'cancelled');

        expect($order->fresh()->status)->toBe('cancelled')
            ->and($this->customer->fresh()->points)->toBe(100 - 50 + 20);
    });

    it('rejects cancelling an order that is already preparing', function () {
        $order = Order::factory()->create(['customer_id' => $this->customer->id, 'status' => 'preparing']);

        postJson(route('api.v1.orders.cancel', $order))->assertUnprocessable();

        expect($order->fresh()->status)->toBe('preparing');
    });

    it("rejects cancelling another customer's order", function () {
        $order = Order::factory()->create(['customer_id' => Customer::factory()->create()->id, 'status' => 'pending']);

        postJson(route('api.v1.orders.cancel', $order))->assertNotFound();

        expect($order->fresh()->status)->toBe('pending');
    });
});
