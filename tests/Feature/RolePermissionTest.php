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

    it('has permissions for the import, the stations and the System page', function () {
        $names = ['import menu items', 'access kitchen', 'access barista', 'view system', 'manage backups', 'restore database', 'reset database'];

        foreach ($names as $name) {
            expect(Permission::where('name', $name)->exists())->toBeTrue("missing permission: {$name}");
        }

        $admin = Role::findByName('admin');
        foreach ($names as $name) {
            expect($admin->hasPermissionTo($name))->toBeTrue("admin lacks: {$name}");
        }
    });

    it('does not hand the System or import permissions to the working roles', function () {
        foreach (['cashier', 'kitchen', 'barista'] as $role) {
            foreach (['import menu items', 'view system', 'manage backups', 'restore database', 'reset database'] as $permission) {
                expect(Role::findByName($role)->hasPermissionTo($permission))->toBeFalse("{$role} should not have {$permission}");
            }
        }

        expect(Role::findByName('barista')->hasPermissionTo('access barista'))->toBeTrue()
            ->and(Role::findByName('kitchen')->hasPermissionTo('access kitchen'))->toBeTrue();
    });

    it('lists the new permissions on the roles page', function () {
        actingAs($this->admin)
            ->get(route('admin.roles.index'))
            ->assertInertia(fn ($page) => $page
                ->where('permissionGroups.System', ['view system', 'manage backups', 'restore database', 'reset database'])
                ->where('permissionGroups.Barista', ['access barista'])
                ->where('permissionGroups.Menu', fn ($menu) => in_array('import menu items', $menu->all(), true)));
    });
});
