<?php

use App\Models\Order;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('Kitchen Display', function () {
    beforeEach(function () {
        $this->kitchenUser = User::factory()->create();
        $this->kitchenUser->assignRole('kitchen');
    });

    it('kitchen user can access the KDS', function () {
        actingAs($this->kitchenUser)
            ->get(route('kitchen.index'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page->component('Kitchen/KitchenDisplay'));
    });

    it('unauthenticated user is redirected from KDS', function () {
        get(route('kitchen.index'))->assertRedirect();
    });

    it('kitchen user can update an order status', function () {
        $order = Order::factory()->create(['status' => 'pending']);

        actingAs($this->kitchenUser)
            ->withSession(['_token' => 'test-token'])
            ->patchJson(
                route('kitchen.orders.update-status', $order->id),
                ['status' => 'preparing'],
                ['X-CSRF-TOKEN' => 'test-token'],
            )
            ->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'preparing']);
    });

    it('returns active orders in FIFO order by created_at', function () {
        $older = Order::factory()->create([
            'status' => 'pending',
            'created_at' => now()->subMinutes(10),
        ]);
        $newer = Order::factory()->create([
            'status' => 'preparing',
            'created_at' => now()->subMinutes(5),
        ]);

        actingAs($this->kitchenUser)
            ->get(route('kitchen.index'))
            ->assertInertia(fn ($page) => $page
                ->component('Kitchen/KitchenDisplay')
                ->has('initialOrders', 2)
                ->where('initialOrders.0.id', $older->id)
                ->where('initialOrders.1.id', $newer->id)
            );
    });

    it('cannot update status to an invalid value', function () {
        $order = Order::factory()->create(['status' => 'pending']);

        $response = actingAs($this->kitchenUser)
            ->withSession(['_token' => 'test-token'])
            ->patchJson(
                route('kitchen.orders.update-status', $order->id),
                ['status' => 'invalid_status'],
                ['X-CSRF-TOKEN' => 'test-token'],
            );
        expect($response->getStatusCode())->toBeIn([302, 422]);
    });
});
