<?php

use App\Models\Category;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Setting;
use App\Models\Table;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\get;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

describe('Storefront API', function () {
    it('returns cafe settings', function () {
        Setting::set('cafe_name', 'Bean There');

        getJson(route('api.v1.storefront'))
            ->assertOk()
            ->assertJsonPath('data.cafe_name', 'Bean There')
            ->assertJsonStructure(['data' => ['currency', 'tax_rate', 'delivery_fee', 'free_delivery_minimum', 'recaptcha_site_key']])
            ->assertJsonPath('data.email_verification_required', true);
    });

    it('returns active categories with available items and featured picks', function () {
        $category = Category::factory()->create();
        MenuItem::factory()->create(['category_id' => $category->id, 'name' => 'Spanish Latte', 'is_featured' => true]);
        MenuItem::factory()->create(['category_id' => $category->id, 'name' => 'Sold Out', 'is_available' => false]);

        getJson(route('api.v1.menu'))
            ->assertOk()
            ->assertJsonCount(1, 'data.categories.0.menu_items')
            ->assertJsonPath('data.categories.0.menu_items.0.name', 'Spanish Latte')
            ->assertJsonPath('data.featured_items.0.name', 'Spanish Latte');
    });

    it('resolves an active table by QR token', function () {
        $table = Table::factory()->create();

        getJson(route('api.v1.tables.show', $table->qr_token))
            ->assertOk()
            ->assertJsonPath('data.id', $table->id);
    });

    it('returns 404 for an invalid QR token', function () {
        getJson(route('api.v1.tables.show', 'invalid-token'))->assertNotFound();
    });

    it('forwards old printed table QR links to the frontend', function () {
        config(['app.frontend_url' => 'https://order.example.com']);

        get('/order/abc-123')->assertRedirect('https://order.example.com/t/abc-123');
        get('/order')->assertRedirect('https://order.example.com');
    });
});

describe('Placing orders', function () {
    beforeEach(function () {
        $this->table = Table::factory()->create();
        $this->item = MenuItem::factory()->create(['category_id' => Category::factory()->create()->id, 'price' => 180]);
    });

    it('places a dine-in order with the table QR token', function () {
        Sanctum::actingAs(Customer::factory()->create());

        postJson(route('api.v1.orders.store'), [
            'qr_token' => $this->table->qr_token,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 2, 'addon_ids' => []]],
        ])->assertCreated()->assertJsonPath('order.status', 'pending');

        $this->assertDatabaseHas('orders', ['table_id' => $this->table->id, 'type' => 'dine-in', 'status' => 'pending']);
    });

    it('rejects a guest and asks them to sign in', function () {
        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnauthorized();
    });

    it('ignores a signed-in staff session on the customer API', function () {
        $this->actingAs(User::factory()->create(), 'web');

        getJson(route('api.v1.me'))->assertUnauthorized();
    });

    it('rejects an order from an unverified customer', function () {
        Sanctum::actingAs(Customer::factory()->unverified()->create());

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertForbidden()->assertJsonPath('requires_verification', true);
    });

    it('lets an unverified customer order when verification is turned off', function () {
        Setting::set('customer_email_verification', '0');
        Sanctum::actingAs(Customer::factory()->unverified()->create());

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertCreated();
    });

    it('rejects an order with missing required fields', function () {
        Sanctum::actingAs(Customer::factory()->create());

        postJson(route('api.v1.orders.store'), [])->assertUnprocessable()->assertInvalid(['type', 'items']);
    });

    it('rejects a dine-in order with an unknown or inactive table', function () {
        Sanctum::actingAs(Customer::factory()->create());
        $inactive = Table::factory()->create(['is_active' => false]);

        postJson(route('api.v1.orders.store'), [
            'qr_token' => $inactive->qr_token,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertInvalid(['qr_token']);
    });

    it('rejects dine-in without a table QR token', function () {
        Sanctum::actingAs(Customer::factory()->create());

        postJson(route('api.v1.orders.store'), [
            'type' => 'dine-in',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertInvalid(['type']);
    });

    it('rejects an item that is no longer available', function () {
        Sanctum::actingAs(Customer::factory()->create());
        $this->item->update(['is_available' => false]);

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertInvalid(['items']);
    });

    it('places an online pickup order with COD', function () {
        $customer = Customer::factory()->create();
        Sanctum::actingAs($customer);

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertCreated()->assertJsonPath('order.status', 'pending');

        $this->assertDatabaseHas('orders', ['customer_id' => $customer->id, 'table_id' => null, 'type' => 'pickup', 'payment_method' => 'cod']);
    });

    it('places an online delivery order with GCash proof of payment', function () {
        Storage::fake('public');
        Sanctum::actingAs(Customer::factory()->create());

        $this->post(route('api.v1.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Sample St., Brgy. Uno, Quezon City',
            'delivery_lat' => 14.6349149,
            'delivery_lng' => 121.0322083,
            'payment_method' => 'gcash',
            'payment_proof' => UploadedFile::fake()->image('gcash-receipt.jpg'),
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ], ['Accept' => 'application/json'])->assertCreated();

        $order = Order::latest('id')->first();
        expect($order->type)->toBe('delivery')
            ->and($order->delivery_address)->toBe('123 Sample St., Brgy. Uno, Quezon City')
            ->and($order->payment_method)->toBe('gcash')
            ->and($order->getFirstMedia('payment_proof'))->not->toBeNull();
    });

    it('rejects a delivery order without an address', function () {
        Sanctum::actingAs(Customer::factory()->create());

        postJson(route('api.v1.orders.store'), [
            'type' => 'delivery',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertInvalid(['delivery_address']);
    });

    it('rejects an e-wallet order without proof of payment', function () {
        Sanctum::actingAs(Customer::factory()->create());

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'maya',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertInvalid(['payment_proof']);
    });

    it('rejects an online order without a payment method', function () {
        Sanctum::actingAs(Customer::factory()->create());

        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertUnprocessable()->assertInvalid(['payment_method']);
    });
});

describe('Delivery Fee', function () {
    beforeEach(function () {
        Setting::set('delivery_fee', '50');
        Setting::set('free_delivery_minimum', '500');
        Setting::set('tax_rate', '0');
        Sanctum::actingAs(Customer::factory()->create());
        $this->item = MenuItem::factory()->create(['category_id' => Category::factory()->create()->id, 'price' => 180]);
    });

    it('charges the delivery fee below the free-delivery minimum', function () {
        postJson(route('api.v1.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Test St.',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertCreated();

        $order = Order::latest('id')->first();
        expect($order->delivery_fee)->toBe(50.0)
            ->and($order->total)->toBe(180.0 + 50.0);
    });

    it('waives the fee at or above the free-delivery minimum', function () {
        postJson(route('api.v1.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Test St.',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 3]],
        ])->assertCreated();

        $order = Order::latest('id')->first();
        expect($order->delivery_fee)->toBe(0.0)
            ->and($order->total)->toBe(540.0);
    });

    it('never charges a delivery fee on pickup orders', function () {
        postJson(route('api.v1.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        ])->assertCreated();

        expect(Order::latest('id')->first()->delivery_fee)->toBe(0.0);
    });

    it('always charges the fee when no free-delivery minimum is set', function () {
        Setting::set('free_delivery_minimum', '0');

        postJson(route('api.v1.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Test St.',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 5]],
        ])->assertCreated();

        expect(Order::latest('id')->first()->delivery_fee)->toBe(50.0);
    });
});
