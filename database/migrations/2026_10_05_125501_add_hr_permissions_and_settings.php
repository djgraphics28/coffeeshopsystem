<?php

use App\Actions\Hr\HrSettings;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /** @var list<string> */
    private const PERMISSIONS = ['view employees', 'manage employees', 'view attendance', 'manage attendance', 'view payroll', 'manage payroll'];

    /**
     * Adds the Human Resource permissions (given to the admin role only, without touching customised roles)
     * and writes the default payroll settings.
     */
    public function up(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

        foreach (self::PERMISSIONS as $name) {
            $admin->givePermissionTo(Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']));
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        HrSettings::seedDefaults();
    }

    public function down(): void
    {
        Permission::whereIn('name', self::PERMISSIONS)->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
};
