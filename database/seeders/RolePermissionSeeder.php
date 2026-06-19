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
        'view orders',
        'manage orders',
        'void orders',
        'manage users',
        'manage roles',
        'manage categories',
        'manage menu items',
        'manage addon groups',
        'manage tables',
        'manage settings',
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
        $kitchen->syncPermissions([
            'access kitchen',
            'view orders',
        ]);
    }
}
