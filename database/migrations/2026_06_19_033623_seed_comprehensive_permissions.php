<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /** @var array<string, string[]> */
    private array $permissions = [
        'Dashboard' => [
            'view dashboard',
        ],
        'Menu' => [
            'view menu',
            'manage categories',
            'manage menu items',
            'manage addon groups',
        ],
        'Orders' => [
            'view orders',
            'create orders',
            'manage orders',
            'void orders',
        ],
        'POS' => [
            'access pos',
            'process payments',
            'apply discounts',
        ],
        'Kitchen' => [
            'access kitchen',
            'update order status',
        ],
        'Customers' => [
            'view customers',
            'manage customers',
            'adjust loyalty',
        ],
        'Promos' => [
            'view promos',
            'manage promos',
        ],
        'Tables' => [
            'view tables',
            'manage tables',
        ],
        'Staff' => [
            'manage users',
            'manage roles',
        ],
        'Settings' => [
            'manage settings',
        ],
    ];

    /** @var array<string, string[]> */
    private array $roleDefaults = [
        'admin' => '*',
        'cashier' => [
            'view dashboard',
            'view menu',
            'access pos',
            'process payments',
            'apply discounts',
            'create orders',
            'view orders',
            'manage orders',
            'view customers',
            'view promos',
            'view tables',
        ],
        'kitchen' => [
            'access kitchen',
            'update order status',
            'view orders',
        ],
    ];

    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $allPermissions = collect($this->permissions)->flatten()->all();

        foreach ($allPermissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        foreach ($this->roleDefaults as $roleName => $perms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);

            if ($perms === '*') {
                $role->syncPermissions(Permission::all());
            } else {
                $role->syncPermissions($perms);
            }
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (collect($this->permissions)->flatten() as $name) {
            Permission::where('name', $name)->where('guard_name', 'web')->delete();
        }
    }
};
