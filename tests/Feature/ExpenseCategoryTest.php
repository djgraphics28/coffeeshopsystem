<?php

use App\Models\ExpenseCategory;
use App\Models\User;
use Illuminate\Support\Facades\Route;

use function Pest\Laravel\actingAs;

describe('Expense categories on the Expenses page', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    });

    it('shares all categories with the expenses page for managers', function () {
        ExpenseCategory::create(['name' => 'Active one', 'color' => '#111111', 'is_active' => true]);
        ExpenseCategory::create(['name' => 'Inactive one', 'color' => '#222222', 'is_active' => false]);

        actingAs($this->admin)
            ->get(route('admin.expenses.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Expenses/Index')
                ->has('categories', 2)
                ->where('can.manage_categories', true));
    });

    it('no longer has a standalone categories page', function () {
        expect(Route::has('admin.expense-categories.index'))->toBeFalse();
        actingAs($this->admin)->get('/admin/expense-categories')->assertStatus(405);
    });

    it('can create and delete a category', function () {
        actingAs($this->admin)
            ->post(route('admin.expense-categories.store'), ['name' => 'Utilities', 'color' => '#3B82F6', 'is_active' => true])
            ->assertRedirect();

        $category = ExpenseCategory::firstWhere('name', 'Utilities');
        expect($category)->not->toBeNull();

        actingAs($this->admin)
            ->delete(route('admin.expense-categories.destroy', $category))
            ->assertRedirect();

        $this->assertDatabaseMissing('expense_categories', ['id' => $category->id]);
    });
});
