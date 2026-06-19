<?php

use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

use function Pest\Laravel\actingAs;

describe('Roles & Permissions', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    });

    it('admin can view roles page', function () {
        actingAs($this->admin)
            ->get(route('admin.roles.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/Roles/Index'));
    });

    it('seeds default permissions', function () {
        expect(Permission::count())->toBeGreaterThanOrEqual(13);
        expect(Role::where('name', 'admin')->first()?->permissions)->not->toBeEmpty();
    });

    it('admin role has void orders permission', function () {
        $admin = Role::where('name', 'admin')->first();

        expect($admin?->hasPermissionTo('void orders'))->toBeTrue();
    });

    it('cashier role has void orders permission', function () {
        $cashier = Role::where('name', 'cashier')->first();

        expect($cashier?->hasPermissionTo('void orders'))->toBeTrue();
    });

    it('kitchen role does not have void orders permission', function () {
        $kitchen = Role::where('name', 'kitchen')->first();

        expect($kitchen?->hasPermissionTo('void orders'))->toBeFalse();
    });
});
