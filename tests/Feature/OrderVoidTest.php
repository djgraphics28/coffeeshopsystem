<?php

use App\Models\Order;
use App\Models\User;

use function Pest\Laravel\actingAs;

describe('Order Void', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    });

    it('admin can void a pending order', function () {
        $order = Order::factory()->create(['status' => 'pending']);

        actingAs($this->admin)
            ->withSession(['_token' => 'test-token'])
            ->post(route('admin.orders.void', $order), [], ['X-CSRF-TOKEN' => 'test-token'])
            ->assertRedirect();

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'voided']);
    });

    it('cannot void a completed order', function () {
        $order = Order::factory()->create(['status' => 'completed']);

        actingAs($this->admin)
            ->withSession(['_token' => 'test-token'])
            ->post(route('admin.orders.void', $order), [], ['X-CSRF-TOKEN' => 'test-token'])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'completed']);
    });

    it('voided orders are excluded from active scope', function () {
        Order::factory()->create(['status' => 'voided']);
        Order::factory()->create(['status' => 'pending']);

        expect(Order::active()->count())->toBe(1);
    });

    it('cannot reopen a closed order through the status endpoint', function () {
        $order = Order::factory()->create(['status' => 'completed']);

        actingAs($this->admin)
            ->patch(route('admin.orders.update-status', $order), ['status' => 'pending'])
            ->assertRedirect()
            ->assertSessionHas('error');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'completed']);
    });

    it('cannot void an order by setting its status directly', function () {
        $order = Order::factory()->create(['status' => 'pending']);

        actingAs($this->admin)
            ->patch(route('admin.orders.update-status', $order), ['status' => 'voided'])
            ->assertSessionHasErrors('status');

        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'pending']);
    });
});
