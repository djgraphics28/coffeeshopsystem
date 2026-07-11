<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    /** @var list<string> */
    public const PERMISSIONS = [
        'access admin',
        'access pos',
        'access kitchen',
        'view dashboard',
        'view orders',
        'create orders',
        'manage orders',
        'void orders',
        'process payments',
        'apply discounts',
        'update order status',
        'view menu',
        'manage categories',
        'manage menu items',
        'manage addon groups',
        'view tables',
        'manage tables',
        'view customers',
        'manage customers',
        'adjust loyalty',
        'view promos',
        'manage promos',
        'manage users',
        'manage roles',
        'manage settings',
        'view expenses',
        'manage expenses',
        'manage expense categories',
    ];

    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $allPermissions = Permission::all();

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions($allPermissions);

        $cashier = Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);
        $cashier->syncPermissions([
            'access pos',
            'view orders',
            'void orders',
        ]);

        $kitchen = Role::firstOrCreate(['name' => 'kitchen', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'driver', 'guard_name' => 'web']);
        $kitchen->syncPermissions([
            'access kitchen',
            'view orders',
        ]);
    }
}
