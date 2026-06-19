<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    /** @var array<string, string[]> */
    private array $permissionGroups = [
        'Dashboard' => ['view dashboard'],
        'Menu' => ['view menu', 'manage categories', 'manage menu items', 'manage addon groups'],
        'Orders' => ['view orders', 'create orders', 'manage orders', 'void orders'],
        'POS' => ['access pos', 'process payments', 'apply discounts'],
        'Kitchen' => ['access kitchen', 'update order status'],
        'Customers' => ['view customers', 'manage customers', 'adjust loyalty'],
        'Promos' => ['view promos', 'manage promos'],
        'Tables' => ['view tables', 'manage tables'],
        'Staff' => ['manage users', 'manage roles'],
        'Settings' => ['manage settings'],
    ];

    public function index(): Response
    {
        $roles = Role::with('permissions')
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name')->values(),
                'users_count' => $role->users_count,
                'is_system' => in_array($role->name, ['admin', 'cashier', 'kitchen'], true),
            ]);

        $permissions = Permission::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Admin/Roles/Index', [
            'roles' => $roles,
            'permissions' => $permissions,
            'permissionGroups' => $this->permissionGroups,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:roles,name'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);
        $role->syncPermissions($validated['permissions'] ?? []);

        return redirect()->back()->with('success', "Role \"{$role->name}\" created.");
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $isSystem = in_array($role->name, ['admin', 'cashier', 'kitchen'], true);

        $validated = $request->validate([
            'name' => $isSystem ? ['sometimes'] : ['required', 'string', 'max:50', 'unique:roles,name,'.$role->id],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        if (! $isSystem && isset($validated['name'])) {
            $role->update(['name' => $validated['name']]);
        }

        $role->syncPermissions($validated['permissions'] ?? []);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return redirect()->back()->with('success', "Role \"{$role->name}\" updated.");
    }

    public function destroy(Role $role): RedirectResponse
    {
        if (in_array($role->name, ['admin', 'cashier', 'kitchen'], true)) {
            return redirect()->back()->with('error', 'System roles cannot be deleted.');
        }

        if (User::role($role->name)->exists()) {
            return redirect()->back()->with('error', "Cannot delete \"{$role->name}\" — it is still assigned to users.");
        }

        $role->delete();

        return redirect()->back()->with('success', "Role \"{$role->name}\" deleted.");
    }

    public function togglePermission(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'permission' => ['required', 'string', 'exists:permissions,name'],
        ]);

        $permission = $validated['permission'];

        if ($role->hasPermissionTo($permission)) {
            $role->revokePermissionTo($permission);
            $has = false;
        } else {
            $role->givePermissionTo($permission);
            $has = true;
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return response()->json(['has' => $has, 'permission' => $permission]);
    }

    public function duplicate(Request $request, Role $role): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:roles,name'],
        ]);

        $newRole = Role::create(['name' => $validated['name'], 'guard_name' => 'web']);
        $newRole->syncPermissions($role->permissions);

        return redirect()->back()->with('success', "Role \"{$newRole->name}\" cloned from \"{$role->name}\".");
    }
}
