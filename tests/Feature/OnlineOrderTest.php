<?php

use App\Events\OnlineOrderPlaced;
use App\Events\OrderPlaced;
use App\Models\Category;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OnlineOrderWaiting;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\artisan;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
    $this->customer = Customer::factory()->create(['points' => 0]);
});

function onlineOrder(array $attributes = []): Order
{
    return Order::factory()->create([
        'source' => Order::SOURCE_ONLINE,
        'status' => 'pending',
        'type' => 'pickup',
        'table_id' => null,
        'customer_id' => test()->customer->id,
        ...$attributes,
    ]);
}

describe('Placing online orders', function () {
    it('marks storefront orders as online, awaiting acceptance, and alerts the admin panel', function () {
        Event::fake([OnlineOrderPlaced::class, OrderPlaced::class]);
        $item = MenuItem::factory()->create(['category_id' => Category::factory()->create()->id, 'price' => 150]);
        Sanctum::actingAs($this->customer);

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1]],
        ])->assertCreated()
            ->assertJsonPath('order.source', 'online')
            ->assertJsonPath('order.awaiting_acceptance', true);

        Event::assertDispatched(OnlineOrderPlaced::class);
        Event::assertNotDispatched(OrderPlaced::class);
    });

    it('keeps unaccepted online orders off the kitchen board', function () {
        $item = MenuItem::factory()->create(['category_id' => Category::factory()->create()->id, 'is_kitchen' => true]);
        $waiting = onlineOrder();
        $waiting->items()->create(['menu_item_id' => $item->id, 'quantity' => 1, 'unit_price' => 100, 'subtotal' => 100]);
        $accepted = onlineOrder(['accepted_at' => now()]);
        $accepted->items()->create(['menu_item_id' => $item->id, 'quantity' => 1, 'unit_price' => 100, 'subtotal' => 100]);

        actingAs($this->admin)->get(route('kitchen.index'))
            ->assertInertia(fn ($page) => $page->has('initialOrders', 1)->where('initialOrders.0.id', $accepted->id));

        actingAs($this->admin)->patchJson(route('kitchen.orders.update-status', $waiting), ['status' => 'preparing'])
            ->assertUnprocessable();
    });
});

describe('Admin online orders', function () {
    it('lists waiting, in-progress and finished online orders separately from POS orders', function () {
        $waiting = onlineOrder();
        $inProgress = onlineOrder(['accepted_at' => now(), 'status' => 'preparing']);
        Order::factory()->create(['status' => 'pending']); // POS order — not listed

        actingAs($this->admin)->get(route('admin.online-orders.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/OnlineOrders/Index')
                ->has('waiting', 1)
                ->where('waiting.0.id', $waiting->id)
                ->has('inProgress', 1)
                ->where('inProgress.0.id', $inProgress->id));
    });

    it('feeds the alert pulse with waiting orders and how long they waited', function () {
        onlineOrder(['created_at' => now()->subMinutes(7)]);

        actingAs($this->admin)->getJson(route('admin.online-orders.pulse'))
            ->assertOk()
            ->assertJsonPath('reminder_minutes', 5)
            ->assertJsonCount(1, 'waiting')
            ->assertJsonPath('waiting.0.waiting_minutes', 7);
    });

    it('accepts an order and releases it to the stations', function () {
        Event::fake([OrderPlaced::class]);
        $order = onlineOrder();

        actingAs($this->admin)->post(route('admin.online-orders.accept', $order))->assertRedirect();

        expect($order->fresh()->accepted_at)->not->toBeNull()
            ->and($order->fresh()->accepted_by)->toBe($this->admin->id)
            ->and($order->fresh()->isAwaitingAcceptance())->toBeFalse();
        Event::assertDispatched(OrderPlaced::class);
    });

    it('declines an order with a reason and refunds redeemed points', function () {
        $this->customer->update(['points' => 10]);
        $order = onlineOrder(['points_earned' => 0, 'points_redeemed' => 40]);

        actingAs($this->admin)->post(route('admin.online-orders.decline', $order), ['reason' => 'Out of oat milk'])->assertRedirect();

        expect($order->fresh()->status)->toBe('cancelled')
            ->and($order->fresh()->decline_reason)->toBe('Out of oat milk')
            ->and($this->customer->fresh()->points)->toBe(50);
    });

    it('requires a reason to decline', function () {
        actingAs($this->admin)->post(route('admin.online-orders.decline', onlineOrder()), ['reason' => ''])
            ->assertSessionHasErrors('reason');
    });

    it('will not accept an order twice', function () {
        $order = onlineOrder(['accepted_at' => now()->subMinute()]);

        actingAs($this->admin)->post(route('admin.online-orders.accept', $order))->assertSessionHas('error');
    });

    it('filters the main orders list by channel', function () {
        $online = onlineOrder();
        Order::factory()->create();

        actingAs($this->admin)->get(route('admin.orders.index', ['source' => 'online']))
            ->assertInertia(fn ($page) => $page->has('orders.data', 1)->where('orders.data.0.id', $online->id));
    });

    it('blocks non-admins', function () {
        actingAs(User::factory()->create())->get(route('admin.online-orders.index'))->assertForbidden();
    });
});

describe('Customers and online orders', function () {
    it('shows the customer their order is awaiting confirmation, then lets them cancel', function () {
        $order = onlineOrder();
        Sanctum::actingAs($this->customer);

        getJson(route('api.v1.orders.show', $order))->assertJsonPath('data.awaiting_acceptance', true);
        postJson(route('api.v1.orders.cancel', $order))->assertOk();
    });

    it('stops the customer cancelling once the café accepted', function () {
        $order = onlineOrder(['accepted_at' => now()]);
        Sanctum::actingAs($this->customer);

        postJson(route('api.v1.orders.cancel', $order))->assertUnprocessable();
        expect($order->fresh()->status)->toBe('pending');
    });
});

describe('5-minute acceptance reminder', function () {
    it('emails admins once about orders waiting over 5 minutes', function () {
        Notification::fake();
        $late = onlineOrder(['created_at' => now()->subMinutes(6)]);
        onlineOrder(['created_at' => now()->subMinutes(2)]);
        onlineOrder(['created_at' => now()->subMinutes(9), 'accepted_at' => now()]);

        artisan('orders:remind-unaccepted')->assertSuccessful();

        Notification::assertSentTo($this->admin, OnlineOrderWaiting::class, fn ($notification) => $notification->order->is($late));
        Notification::assertSentToTimes($this->admin, OnlineOrderWaiting::class, 1);
        expect($late->fresh()->reminded_at)->not->toBeNull();

        artisan('orders:remind-unaccepted')->assertSuccessful();
        Notification::assertSentToTimes($this->admin, OnlineOrderWaiting::class, 1);
    });
});
