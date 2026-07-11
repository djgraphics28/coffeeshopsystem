<?php

use App\Models\Category;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\Order;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('Customer Account', function () {
    beforeEach(function () {
        $this->customer = Customer::factory()->create();
    });

    it('shows order history for the signed-in customer only', function () {
        $category = Category::factory()->create();
        MenuItem::factory()->create(['category_id' => $category->id]);
        $mine = Order::factory()->create(['customer_id' => $this->customer->id]);
        Order::factory()->create(['customer_id' => Customer::factory()->create()->id]);

        actingAs($this->customer, 'customer')
            ->get(route('customer.account.orders'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Customer/OrderHistory')
                ->has('orders', 1)
                ->where('orders.0.order_number', $mine->order_number)
            );
    });

    it('shows the profile page with stats', function () {
        Order::factory()->create(['customer_id' => $this->customer->id, 'total' => 250]);

        actingAs($this->customer, 'customer')
            ->get(route('customer.account.profile'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Customer/Profile')
                ->where('stats.total_orders', 1)
            );
    });

    it('updates the profile name and phone', function () {
        actingAs($this->customer, 'customer')
            ->put(route('customer.account.profile.update'), ['name' => 'New Name', 'phone' => '09170001111'])
            ->assertRedirect();

        expect($this->customer->fresh()->name)->toBe('New Name')
            ->and($this->customer->fresh()->phone)->toBe('09170001111');
    });

    it('redirects guests to the customer login', function () {
        get(route('customer.account.orders'))->assertRedirect(route('customer.auth.login'));
        get(route('customer.account.profile'))->assertRedirect(route('customer.auth.login'));
    });

    it('shares the active order with customer pages', function () {
        $order = Order::factory()->create(['customer_id' => $this->customer->id, 'status' => 'preparing']);
        Order::factory()->create(['customer_id' => $this->customer->id, 'status' => 'completed']);

        actingAs($this->customer, 'customer')
            ->get(route('storefront.browse'))
            ->assertInertia(fn ($page) => $page
                ->where('customer_auth.active_order.id', $order->id)
                ->where('customer_auth.active_order.status', 'preparing')
            );
    });
});

describe('Customer Order Cancellation', function () {
    beforeEach(function () {
        $this->customer = Customer::factory()->create();
    });

    it('lets a customer cancel their pending order and refunds loyalty', function () {
        $this->customer->update(['points' => 100]);
        $order = Order::factory()->create([
            'customer_id' => $this->customer->id,
            'status' => 'pending',
            'points_earned' => 50,
            'points_redeemed' => 20,
        ]);

        actingAs($this->customer, 'customer')
            ->postJson(route('storefront.orders.cancel', $order))
            ->assertStatus(200)
            ->assertJsonPath('order.status', 'cancelled');

        expect($order->fresh()->status)->toBe('cancelled')
            ->and($this->customer->fresh()->points)->toBe(100 - 50 + 20);
    });

    it('rejects cancelling an order that is already preparing', function () {
        $order = Order::factory()->create(['customer_id' => $this->customer->id, 'status' => 'preparing']);

        actingAs($this->customer, 'customer')
            ->postJson(route('storefront.orders.cancel', $order))
            ->assertStatus(422);

        expect($order->fresh()->status)->toBe('preparing');
    });

    it("rejects cancelling another customer's order", function () {
        $order = Order::factory()->create(['customer_id' => Customer::factory()->create()->id, 'status' => 'pending']);

        actingAs($this->customer, 'customer')
            ->postJson(route('storefront.orders.cancel', $order))
            ->assertStatus(403);
    });
});
