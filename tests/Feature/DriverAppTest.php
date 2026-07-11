<?php

use App\Models\DeliveryMan;
use App\Models\Order;
use App\Models\User;

use function Pest\Laravel\actingAs;

describe('Driver Accounts (Admin)', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->man = DeliveryMan::factory()->create(['name' => 'Pedro Rider']);
    });

    it('creates a driver login linked to the delivery man', function () {
        actingAs($this->admin)->put(route('admin.delivery-men.account', $this->man), [
            'email' => 'pedro@rider.test',
            'password' => 'secret-pass-123',
        ])->assertRedirect();

        $this->man->refresh();
        expect($this->man->user)->not->toBeNull()
            ->and($this->man->user->email)->toBe('pedro@rider.test')
            ->and($this->man->user->hasRole('driver'))->toBeTrue();
    });

    it('updates an existing driver account email without requiring a password', function () {
        actingAs($this->admin)->put(route('admin.delivery-men.account', $this->man), [
            'email' => 'pedro@rider.test', 'password' => 'secret-pass-123',
        ]);

        actingAs($this->admin)->put(route('admin.delivery-men.account', $this->man), [
            'email' => 'pedro.new@rider.test', 'password' => '',
        ])->assertRedirect()->assertSessionHasNoErrors();

        expect($this->man->fresh()->user->email)->toBe('pedro.new@rider.test');
    });
});

describe('Driver App', function () {
    beforeEach(function () {
        $this->driverUser = User::factory()->create();
        $this->driverUser->assignRole('driver');
        $this->man = DeliveryMan::factory()->create(['user_id' => $this->driverUser->id]);
    });

    it('shows only the deliveries assigned to the signed-in driver', function () {
        $mine = Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'delivery_man_id' => $this->man->id]);
        Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'delivery_man_id' => DeliveryMan::factory()->create()->id]);

        actingAs($this->driverUser)
            ->get(route('driver.index'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Driver/Dashboard')
                ->has('active_orders', 1)
                ->where('active_orders.0.order_number', $mine->order_number)
            );
    });

    it('blocks non-driver users from the driver app', function () {
        $user = User::factory()->create();
        $user->assignRole('cashier');
        actingAs($user)->get(route('driver.index'))->assertForbidden();
    });

    it('lets the driver record COD cash collection', function () {
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'payment_method' => 'cod', 'delivery_man_id' => $this->man->id, 'total' => 300]);

        actingAs($this->driverUser)->post(route('driver.orders.collect-payment', $order))->assertRedirect();

        expect($order->fresh()->payment)->not->toBeNull()
            ->and($order->fresh()->payment->reference_no)->toContain($this->man->name);
    });

    it("blocks collecting payment on another rider's order", function () {
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'payment_method' => 'cod', 'delivery_man_id' => DeliveryMan::factory()->create()->id]);

        actingAs($this->driverUser)->post(route('driver.orders.collect-payment', $order))->assertForbidden();
    });

    it('blocks marking delivered before COD cash is collected', function () {
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'payment_method' => 'cod', 'delivery_man_id' => $this->man->id]);

        actingAs($this->driverUser)->post(route('driver.orders.delivered', $order))
            ->assertRedirect()->assertSessionHas('error');

        expect($order->fresh()->status)->toBe('ready');
    });

    it('marks a paid delivery as completed', function () {
        $order = Order::factory()->create(['type' => 'delivery', 'status' => 'ready', 'payment_method' => 'gcash', 'delivery_man_id' => $this->man->id]);
        $order->payment()->create(['amount' => 100, 'method' => 'gcash', 'paid_at' => now()]);

        actingAs($this->driverUser)->post(route('driver.orders.delivered', $order))->assertRedirect()->assertSessionHas('success');

        expect($order->fresh()->status)->toBe('completed');
    });
});

describe('Driver Login', function () {
    it('shows the driver login page to guests', function () {
        $this->get(route('driver.login'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page->component('Driver/Login'));
    });

    it('signs in a driver and redirects to the driver app', function () {
        $user = User::factory()->create(['password' => bcrypt('rider-pass-123')]);
        $user->assignRole('driver');
        DeliveryMan::factory()->create(['user_id' => $user->id]);

        $this->post(route('driver.login.store'), [
            'email' => $user->email,
            'password' => 'rider-pass-123',
        ])->assertRedirect(route('driver.index'));

        $this->assertAuthenticatedAs($user);
    });

    it('rejects non-driver accounts on the driver login', function () {
        $user = User::factory()->create(['password' => bcrypt('kitchen-pass-123')]);
        $user->assignRole('kitchen');

        $this->post(route('driver.login.store'), [
            'email' => $user->email,
            'password' => 'kitchen-pass-123',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    });

    it('redirects an already signed-in driver to the app', function () {
        $user = User::factory()->create();
        $user->assignRole('driver');

        actingAs($user)->get(route('driver.login'))->assertRedirect(route('driver.index'));
    });
});
