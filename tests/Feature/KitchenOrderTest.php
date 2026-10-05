<?php

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

/**
 * Adds a line for the given menu item to an order.
 */
function addLine(Order $order, MenuItem $item): void
{
    $order->items()->create([
        'menu_item_id' => $item->id,
        'quantity' => 1,
        'unit_price' => $item->price,
        'subtotal' => $item->price,
    ]);
}

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
        addLine($order, MenuItem::factory()->create(['is_kitchen' => true]));

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
        $cooked = MenuItem::factory()->create(['is_kitchen' => true]);
        addLine($older, $cooked);
        addLine($newer, $cooked);

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

    it('only queues orders that contain kitchen items', function () {
        $cooked = MenuItem::factory()->create(['is_kitchen' => true]);
        $bottled = MenuItem::factory()->create(['is_kitchen' => false]);

        $kitchenOrder = Order::factory()->create(['status' => 'pending']);
        addLine($kitchenOrder, $cooked);

        $readyMadeOnly = Order::factory()->create(['status' => 'pending']);
        addLine($readyMadeOnly, $bottled);

        actingAs($this->kitchenUser)
            ->get(route('kitchen.index'))
            ->assertInertia(fn ($page) => $page
                ->has('initialOrders', 1)
                ->where('initialOrders.0.id', $kitchenOrder->id));
    });

    it('shows only the kitchen items of a mixed order', function () {
        $cooked = MenuItem::factory()->create(['name' => 'Pasta', 'is_kitchen' => true]);
        $bottled = MenuItem::factory()->create(['name' => 'Bottled Water', 'is_kitchen' => false]);

        $order = Order::factory()->create(['status' => 'pending']);
        addLine($order, $cooked);
        addLine($order, $bottled);

        actingAs($this->kitchenUser)
            ->get(route('kitchen.index'))
            ->assertInertia(fn ($page) => $page
                ->has('initialOrders.0.items', 1)
                ->where('initialOrders.0.items.0.menu_item.name', 'Pasta'));
    });

    it('lets the kitchen tick an item done and undo it', function () {
        $order = Order::factory()->create(['status' => 'preparing']);
        addLine($order, MenuItem::factory()->create());
        $line = $order->items()->first();

        actingAs($this->kitchenUser)
            ->patchJson(route('kitchen.order-items.toggle', $line), ['done' => true])
            ->assertOk()
            ->assertJsonPath('order.items.0.is_done', true);

        expect($line->fresh()->prepared_at)->not->toBeNull();

        actingAs($this->kitchenUser)
            ->patchJson(route('kitchen.order-items.toggle', $line), ['done' => false])
            ->assertJsonPath('order.items.0.is_done', false);

        expect($line->fresh()->prepared_at)->toBeNull();
    });

    it('moves a pending order to preparing when its first item is ticked', function () {
        $order = Order::factory()->create(['status' => 'pending']);
        addLine($order, MenuItem::factory()->create());

        actingAs($this->kitchenUser)
            ->patchJson(route('kitchen.order-items.toggle', $order->items()->first()), ['done' => true])
            ->assertJsonPath('order.status', 'preparing');

        expect($order->fresh()->status)->toBe('preparing');
    });

    it('checks all kitchen items at once and leaves ready-made items alone', function () {
        $order = Order::factory()->create(['status' => 'pending']);
        addLine($order, MenuItem::factory()->create(['name' => 'Pasta', 'is_kitchen' => true]));
        addLine($order, MenuItem::factory()->create(['name' => 'Soup', 'is_kitchen' => true]));
        addLine($order, MenuItem::factory()->create(['name' => 'Bottled Water', 'is_kitchen' => false]));

        actingAs($this->kitchenUser)
            ->postJson(route('kitchen.orders.check-all', $order))
            ->assertOk()
            ->assertJsonCount(2, 'order.items')
            ->assertJsonPath('order.items.0.is_done', true)
            ->assertJsonPath('order.items.1.is_done', true);

        $bottled = $order->items()->whereHas('menuItem', fn ($q) => $q->where('is_kitchen', false))->first();
        expect($bottled->prepared_at)->toBeNull()
            ->and($order->items()->whereNotNull('prepared_at')->count())->toBe(2);

        actingAs($this->kitchenUser)
            ->postJson(route('kitchen.orders.check-all', $order), ['done' => false])
            ->assertJsonPath('order.items.0.is_done', false);

        expect($order->items()->whereNotNull('prepared_at')->count())->toBe(0);
    });

    it('rejects ticking items on a closed order', function () {
        $order = Order::factory()->create(['status' => 'voided']);
        addLine($order, MenuItem::factory()->create());

        actingAs($this->kitchenUser)
            ->patchJson(route('kitchen.order-items.toggle', $order->items()->first()), ['done' => true])
            ->assertStatus(422);

        actingAs($this->kitchenUser)
            ->postJson(route('kitchen.orders.check-all', $order))
            ->assertStatus(422);
    });

    it('keeps ticked items after a reload', function () {
        $order = Order::factory()->create(['status' => 'preparing']);
        addLine($order, MenuItem::factory()->create());
        $order->items()->update(['prepared_at' => now()]);

        actingAs($this->kitchenUser)
            ->get(route('kitchen.index'))
            ->assertInertia(fn ($page) => $page->where('initialOrders.0.items.0.is_done', true));
    });

    describe('barista station', function () {
        beforeEach(function () {
            $this->barista = User::factory()->create();
            $this->barista->assignRole('barista');
            $this->cooked = MenuItem::factory()->create(['name' => 'Pasta', 'is_kitchen' => true]);
            $this->drink = MenuItem::factory()->create(['name' => 'Iced Latte', 'is_kitchen' => false]);
        });

        it('lets the barista open the board but not the kitchen', function () {
            actingAs($this->barista)->get(route('barista.index'))->assertOk()
                ->assertInertia(fn ($page) => $page->component('Kitchen/KitchenDisplay')->where('station', 'barista'));

            actingAs($this->barista)->get(route('kitchen.index'))->assertForbidden();
            actingAs($this->kitchenUser)->get(route('barista.index'))->assertForbidden();
        });

        it('sends non-kitchen items to the barista and kitchen items to the kitchen', function () {
            $order = Order::factory()->create(['status' => 'pending']);
            addLine($order, $this->cooked);
            addLine($order, $this->drink);
            $drinkOnly = Order::factory()->create(['status' => 'pending']);
            addLine($drinkOnly, $this->drink);

            actingAs($this->barista)->get(route('barista.index'))
                ->assertInertia(fn ($page) => $page
                    ->has('initialOrders', 2)
                    ->where('initialOrders.0.items.0.menu_item.name', 'Iced Latte')
                    ->has('initialOrders.0.items', 1));

            actingAs($this->kitchenUser)->get(route('kitchen.index'))
                ->assertInertia(fn ($page) => $page
                    ->has('initialOrders', 1)
                    ->where('initialOrders.0.items.0.menu_item.name', 'Pasta'));
        });

        it('tracks kitchen and barista progress separately and combines them', function () {
            $order = Order::factory()->create(['status' => 'pending']);
            addLine($order, $this->cooked);
            addLine($order, $this->drink);

            actingAs($this->kitchenUser)
                ->patchJson(route('kitchen.orders.update-status', $order), ['status' => 'ready'])
                ->assertJsonPath('order.kitchen_status', 'ready')
                ->assertJsonPath('order.barista_status', 'pending');
            expect($order->fresh()->status)->toBe('preparing');

            actingAs($this->barista)
                ->patchJson(route('barista.orders.update-status', $order), ['status' => 'ready'])
                ->assertJsonPath('order.barista_status', 'ready');
            expect($order->fresh()->status)->toBe('ready');
        });

        it('leaves a paid order at ready when every station is ready (completing is a separate step)', function () {
            $order = Order::factory()->create(['status' => 'preparing']);
            addLine($order, $this->drink);
            $order->payment()->create(['amount' => 100, 'method' => 'cash', 'paid_at' => now()]);

            actingAs($this->barista)
                ->patchJson(route('barista.orders.update-status', $order), ['status' => 'ready'])
                ->assertOk();

            expect($order->fresh()->status)->toBe('ready');
        });

        it('only lets a station tick its own items', function () {
            $order = Order::factory()->create(['status' => 'pending']);
            addLine($order, $this->cooked);
            addLine($order, $this->drink);
            $cookedLine = $order->items()->where('menu_item_id', $this->cooked->id)->first();
            $drinkLine = $order->items()->where('menu_item_id', $this->drink->id)->first();

            actingAs($this->barista)
                ->patchJson(route('barista.order-items.toggle', $cookedLine), ['done' => true])
                ->assertStatus(422);

            actingAs($this->barista)
                ->patchJson(route('barista.order-items.toggle', $drinkLine), ['done' => true])
                ->assertOk()
                ->assertJsonPath('order.barista_status', 'preparing')
                ->assertJsonPath('order.kitchen_status', 'pending');
        });

        it('rejects a station update for an order it has no items for', function () {
            $order = Order::factory()->create(['status' => 'pending']);
            addLine($order, $this->cooked);

            actingAs($this->barista)
                ->patchJson(route('barista.orders.update-status', $order), ['status' => 'preparing'])
                ->assertStatus(422);
        });

        it('resets station progress when an admin changes the order status manually', function () {
            $admin = User::factory()->create();
            $admin->assignRole('admin');
            $order = Order::factory()->create(['status' => 'preparing', 'kitchen_status' => 'ready', 'barista_status' => 'preparing']);
            addLine($order, $this->cooked);

            actingAs($admin)->patch(route('admin.orders.update-status', $order), ['status' => 'pending']);

            expect($order->fresh()->kitchen_status)->toBeNull()
                ->and($order->fresh()->status)->toBe('pending');
        });
    });
});
