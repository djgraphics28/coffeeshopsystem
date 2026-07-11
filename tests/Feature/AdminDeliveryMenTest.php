<?php

use App\Models\DeliveryMan;
use App\Models\Order;
use App\Models\User;

use function Pest\Laravel\actingAs;

describe('Admin Delivery Men', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    });

    it('lists delivery men', function () {
        DeliveryMan::factory()->count(2)->create();

        actingAs($this->admin)
            ->get(route('admin.delivery-men.index'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Admin/DeliveryMen/Index')
                ->has('delivery_men', 2)
            );
    });

    it('creates, updates and deletes a delivery man', function () {
        actingAs($this->admin)->post(route('admin.delivery-men.store'), [
            'name' => 'Pedro Rider',
            'phone' => '09171112222',
            'vehicle' => 'Motorcycle',
            'is_active' => true,
        ])->assertRedirect();

        $man = DeliveryMan::where('name', 'Pedro Rider')->firstOrFail();

        actingAs($this->admin)->put(route('admin.delivery-men.update', $man), [
            'name' => 'Pedro R.',
            'is_active' => false,
        ])->assertRedirect();

        expect($man->fresh()->name)->toBe('Pedro R.')
            ->and($man->fresh()->is_active)->toBeFalse();

        actingAs($this->admin)->delete(route('admin.delivery-men.destroy', $man))->assertRedirect();
        expect(DeliveryMan::find($man->id))->toBeNull();
    });

    it('assigns a delivery man to a delivery order', function () {
        $man = DeliveryMan::factory()->create();
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'pending']);

        actingAs($this->admin)->patch(route('admin.orders.assign-delivery-man', $order), [
            'delivery_man_id' => $man->id,
        ])->assertRedirect();

        expect($order->fresh()->delivery_man_id)->toBe($man->id);
    });

    it('rejects assigning a delivery man to a non-delivery order', function () {
        $man = DeliveryMan::factory()->create();
        $order = Order::factory()->create(['type' => 'dine-in', 'status' => 'pending']);

        actingAs($this->admin)->patch(route('admin.orders.assign-delivery-man', $order), [
            'delivery_man_id' => $man->id,
        ]);

        expect($order->fresh()->delivery_man_id)->toBeNull();
    });

    it('unassigning a delivery man keeps the order but clears the rider', function () {
        $man = DeliveryMan::factory()->create();
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'pending', 'delivery_man_id' => $man->id]);

        actingAs($this->admin)->patch(route('admin.orders.assign-delivery-man', $order), [
            'delivery_man_id' => null,
        ])->assertRedirect();

        expect($order->fresh()->delivery_man_id)->toBeNull();
    });
});

describe('Order Payment Verification', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    });

    it('approves a GCash order and marks it paid', function () {
        $order = Order::factory()->create(['type' => 'pickup', 'status' => 'pending', 'payment_method' => 'gcash', 'total' => 250]);

        actingAs($this->admin)->post(route('admin.orders.mark-paid', $order))->assertRedirect();

        $payment = $order->fresh()->payment;
        expect($payment)->not->toBeNull()
            ->and($payment->method)->toBe('gcash')
            ->and((float) $payment->amount)->toBe(250.0);
    });

    it('rejects marking a COD delivery paid without an assigned rider', function () {
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'pending', 'payment_method' => 'cod']);

        actingAs($this->admin)->post(route('admin.orders.mark-paid', $order))
            ->assertRedirect()
            ->assertSessionHas('error');

        expect($order->fresh()->payment)->toBeNull();
    });

    it('confirms COD via the assigned rider and records who collected', function () {
        $man = DeliveryMan::factory()->create(['name' => 'Pedro Rider']);
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'payment_method' => 'cod', 'delivery_man_id' => $man->id, 'total' => 300]);

        actingAs($this->admin)->post(route('admin.orders.mark-paid', $order))->assertRedirect()->assertSessionHas('success');

        $payment = $order->fresh()->payment;
        expect($payment->method)->toBe('cash')
            ->and($payment->reference_no)->toContain('Pedro Rider');
    });

    it('does not double-pay an already paid order', function () {
        $order = Order::factory()->create(['type' => 'pickup', 'status' => 'pending', 'payment_method' => 'maya']);
        $order->payment()->create(['amount' => 100, 'method' => 'maya', 'paid_at' => now()]);

        actingAs($this->admin)->post(route('admin.orders.mark-paid', $order))
            ->assertRedirect()
            ->assertSessionHas('error');

        expect($order->payment()->count())->toBe(1);
    });
});
