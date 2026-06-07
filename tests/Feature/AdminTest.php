<?php

use App\Models\Category;
use App\Models\Table;
use App\Models\User;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('Admin Panel', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->cashier = User::factory()->create();
        $this->cashier->assignRole('cashier');
    });

    it('admin can access the admin dashboard', function () {
        actingAs($this->admin)
            ->get(route('admin.dashboard'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page->component('Admin/Dashboard'));
    });

    it('non-admin is forbidden from admin dashboard', function () {
        actingAs($this->cashier)
            ->get(route('admin.dashboard'))
            ->assertForbidden();
    });

    it('admin can view categories list', function () {
        Category::factory()->count(3)->create();

        actingAs($this->admin)
            ->get(route('admin.categories.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/Categories/Index'));
    });

    it('admin can create a category', function () {
        actingAs($this->admin)
            ->post(route('admin.categories.store'), [
                'name' => 'New Category',
                'icon' => '🍵',
                'sort_order' => 10,
                'is_active' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('categories', ['name' => 'New Category']);
    });

    it('admin can view tables list', function () {
        Table::factory()->count(2)->create();

        actingAs($this->admin)
            ->get(route('admin.tables.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/Tables/Index'));
    });

    it('admin can create a table with auto-generated QR token', function () {
        actingAs($this->admin)
            ->post(route('admin.tables.store'), [
                'name' => 'Table 99',
                'is_active' => true,
                'sort_order' => 99,
            ])
            ->assertRedirect();

        $table = Table::where('name', 'Table 99')->first();
        expect($table)->not->toBeNull();
        expect($table->qr_token)->toBeString()->not->toBeEmpty();
    });
});
