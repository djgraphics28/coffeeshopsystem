<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Adds the Barista station role without touching permissions already customised on other roles.
     */
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $permission = Permission::firstOrCreate(['name' => 'access barista', 'guard_name' => 'web']);

        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web'])->givePermissionTo($permission);

        Role::firstOrCreate(['name' => 'barista', 'guard_name' => 'web'])
            ->givePermissionTo([$permission, Permission::firstOrCreate(['name' => 'view orders', 'guard_name' => 'web'])]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Role::where('name', 'barista')->delete();
        Permission::where('name', 'access barista')->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
