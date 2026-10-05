<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /** @var list<string> */
    private const PERMISSIONS = ['import menu items', 'view system', 'manage backups', 'restore database', 'reset database'];

    /**
     * Adds the permissions for the menu import and the System page, and gives them to the admin role
     * without touching permissions already customised on other roles.
     */
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

        foreach (self::PERMISSIONS as $name) {
            $admin->givePermissionTo(Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']));
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::whereIn('name', self::PERMISSIONS)->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
