<?php

use App\Models\Order;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\patchJson;

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
            ->patchJson(route('kitchen.orders.update-status', $order->id), ['status' => 'preparing'])
            ->assertOk()
            ->assertJsonPath('order.status', 'preparing');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'preparing']);
    });

    it('cannot update status to an invalid value', function () {
        $order = Order::factory()->create(['status' => 'pending']);

        $response = actingAs($this->kitchenUser)
            ->patchJson(route('kitchen.orders.update-status', $order->id), ['status' => 'invalid_status']);
        expect($response->getStatusCode())->toBeIn([302, 422]);
    });
});
