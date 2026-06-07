<?php

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Table;

use function Pest\Laravel\get;
use function Pest\Laravel\postJson;

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

    it('returns 404 for an invalid QR token', function () {
        get(route('storefront.show', ['qrToken' => 'invalid-token']))->assertNotFound();
    });

    it('places a customer order successfully', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $response = $this->withSession([
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

    it('rejects an order with missing required fields', function () {
        $response = $this->withSession([
            'storefront_qr_scan' => ['table_id' => $this->table->id, 'scanned_at' => now()->timestamp],
        ])->postJson(route('storefront.orders.store'), ['table_id' => $this->table->id]);
        expect($response->getStatusCode())->toBeIn([302, 422]);
    });

    it('rejects an order when no QR code has been scanned', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        postJson(route('storefront.orders.store'), [
            'table_id' => $this->table->id,
            'type' => 'dine-in',
            'items' => [['menu_item_id' => $item->id, 'quantity' => 1, 'addon_ids' => []]],
        ])->assertStatus(403);
    });

    it('rejects an order when the QR scan has expired', function () {
        $category = Category::factory()->create();
        $item = MenuItem::factory()->create(['category_id' => $category->id, 'price' => 180]);

        $this->withSession([
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

        $this->withSession([
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
