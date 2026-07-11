<?php

use App\Models\Category;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Setting;
use App\Models\Table;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\get;

describe('Customer Storefront', function () {
    beforeEach(function () {
        $this->table = Table::factory()->create();
    });

    it('loads the storefront page for a valid QR token', function () {
        $response = get(route('storefront.show', ['qrToken' => $this->table->qr_token]));
        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Customer/Storefront')
            ->has('table')
            ->has('categories')
            ->where('table.id', $this->table->id)
        );
    });

    it('loads the table-less browse storefront', function () {
        get(route('storefront.browse'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Customer/Storefront')
                ->where('table', null)
                ->has('categories')
            );
    });

    it('returns 404 for an invalid QR token', function () {
        get(route('storefront.show', ['qrToken' => 'invalid-token']))->assertNotFound();
    });

    it('places a customer order successfully', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);
        $customer = Customer::factory()->create();

        $response = $this->actingAs($customer, 'customer')->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->timestamp],
        ])->postJson(route('storefront.orders.store'), [
            'table_id' => $this->table->id,
            'type' => 'dine-in',
            'items' => [
                ['menu_item_id' => $item->id, 'quantity' => 2, 'addon_ids' => []],
            ],
        ]);

        $response->assertStatus(201)->assertJsonPath('order.status', 'pending');
        $this->assertDatabaseHas('orders', ['table_id' => $this->table->id, 'status' => 'pending']);
    });

    it('rejects an order from a guest and asks them to sign in', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->timestamp],
        ])->postJson(route('storefront.orders.store'), [
            'table_id' => $this->table->id,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(401)->assertJsonPath('requires_auth', true);
    });

    it('rejects an order from an unverified customer', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);
        $customer = Customer::factory()->unverified()->create();

        $this->actingAs($customer, 'customer')->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->timestamp],
        ])->postJson(route('storefront.orders.store'), [
            'table_id' => $this->table->id,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(403)->assertJsonPath('requires_verification', true);
    });

    it('rejects an order with missing required fields', function () {
        $response = $this->actingAs(Customer::factory()->create(), 'customer')->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->timestamp],
        ])->postJson(route('storefront.orders.store'), ['table_id' => $this->table->id]);
        expect($response->getStatusCode())->toBeIn([302, 422]);
    });

    it('rejects a dine-in order when no QR code has been scanned', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->actingAs(Customer::factory()->create(), 'customer')->postJson(route('storefront.orders.store'), [
            'table_id' => $this->table->id,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(403);
    });

    it('places an online pickup order with COD without a QR scan', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);
        $customer = Customer::factory()->create();

        $response = $this->actingAs($customer, 'customer')->postJson(route('storefront.orders.store'), [
            'table_id' => null,
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ]);

        $response->assertStatus(201)->assertJsonPath('order.status', 'pending');
        $this->assertDatabaseHas('orders', ['customer_id' => $customer->id, 'table_id' => null, 'type' => 'pickup', 'payment_method' => 'cod']);
    });

    it('places an online delivery order with GCash proof of payment', function () {
        Storage::fake('public');
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);
        $customer = Customer::factory()->create();

        $response = $this->actingAs($customer, 'customer')->post(route('storefront.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Sample St., Brgy. Uno, Quezon City',
            'delivery_lat' => 14.6349149,
            'delivery_lng' => 121.0322083,
            'payment_method' => 'gcash',
            'payment_proof' => UploadedFile::fake()->image('gcash-receipt.jpg'),
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ], ['Accept' => 'application/json']);

        $response->assertStatus(201);
        $order = Order::latest('id')->first();
        expect($order->type)->toBe('delivery')
            ->and($order->delivery_address)->toBe('123 Sample St., Brgy. Uno, Quezon City')
            ->and($order->payment_method)->toBe('gcash')
            ->and($order->getFirstMedia('payment_proof'))->not->toBeNull();
    });

    it('rejects an online delivery order without an address', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->actingAs(Customer::factory()->create(), 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'delivery',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(422)->assertInvalid(['delivery_address']);
    });

    it('rejects an online e-wallet order without proof of payment', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->actingAs(Customer::factory()->create(), 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'maya',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(422)->assertInvalid(['payment_proof']);
    });

    it('rejects an online order without a payment method', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->actingAs(Customer::factory()->create(), 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'pickup',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(422)->assertInvalid(['payment_method']);
    });

    it('rejects an order when the QR scan has expired', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->actingAs(Customer::factory()->create(), 'customer')->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->subHours(3)->timestamp],
        ])->postJson(route('storefront.orders.store'), [
            'table_id' => $this->table->id,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(403);
    });

    it('rejects an order when table_id does not match the scanned QR table', function () {
        $otherTable = Table::factory()->create();
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->actingAs(Customer::factory()->create(), 'customer')->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->timestamp],
        ])->postJson(route('storefront.orders.store'), [
            'table_id' => $otherTable->id,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(403);
    });

    it('stores the QR scan in session when visiting the storefront', function () {
        get(route('storefront.show', ['qrToken' => $this->table->qr_token]))
            ->assertStatus(200)
            ->assertSessionHas('storefront_qr_scan.table_id', $this->table->id);
    });
});

describe('Delivery Fee', function () {
    beforeEach(function () {
        Setting::set('delivery_fee', '50');
        Setting::set('free_delivery_minimum', '500');
        Setting::set('tax_rate', '0');
        $this->customer = Customer::factory()->create();
        $category = Category::factory()->create();
        $this->item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);
    });

    it('charges the delivery fee below the free-delivery minimum', function () {
        $this->actingAs($this->customer, 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Test St.',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(201);

        $order = Order::latest('id')->first();
        expect($order->delivery_fee)->toBe(50.0)
            ->and($order->total)->toBe(180.0 + 50.0);
    });

    it('waives the fee at or above the free-delivery minimum', function () {
        $this->actingAs($this->customer, 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Test St.',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 3, 'addon_ids' => []]],
        ])->assertStatus(201);

        $order = Order::latest('id')->first();
        expect($order->delivery_fee)->toBe(0.0)
            ->and($order->total)->toBe(540.0);
    });

    it('never charges a delivery fee on pickup orders', function () {
        $this->actingAs($this->customer, 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'pickup',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(201);

        expect(Order::latest('id')->first()->delivery_fee)->toBe(0.0);
    });

    it('always charges the fee when no free-delivery minimum is set', function () {
        Setting::set('free_delivery_minimum', '0');

        $this->actingAs($this->customer, 'customer')->postJson(route('storefront.orders.store'), [
            'type' => 'delivery',
            'delivery_address' => '123 Test St.',
            'payment_method' => 'cod',
            'items' => [['menu_item_id' => $this->item->id, 'quantity' => 5, 'addon_ids' => []]],
        ])->assertStatus(201);

        expect(Order::latest('id')->first()->delivery_fee)->toBe(50.0);
    });
});
