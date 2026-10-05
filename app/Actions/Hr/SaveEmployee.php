<?php

namespace App\Actions\Hr;

use App\Models\Employee;
use App\Models\Position;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Creates or updates an employee, their optional system login, and (for drivers) the delivery man record.
 */
class SaveEmployee
{
    public function __construct(private readonly SyncDriverRecord $drivers) {}

    /**
     * @param  array<string, mixed>  $data  employee fields
     * @param  array{email?: string|null, password?: string|null, role?: string|null}  $account  optional login details
     */
    public function handle(array $data, array $account = [], ?Employee $employee = null): Employee
    {
        return DB::transaction(function () use ($data, $account, $employee) {
            $position = Position::findOrFail($data['position_id']);

            // Only drivers have a vehicle on record.
            if (! $position->is_driver) {
                $data['vehicle'] = null;
            }

            if ($employee) {
                $employee->update($data);
            } else {
                // The code is derived from the id, so create with a placeholder first.
                $employee = Employee::create($data + ['employee_code' => 'TMP-'.uniqid()]);
                $employee->update(['employee_code' => Employee::codeFor($employee->id)]);
            }

            $this->saveAccount($employee, $position, $account);
            $this->syncAccess($employee->fresh('user'), $position);
            $this->drivers->handle($employee->fresh(['position', 'user']));

            return $employee->fresh(['position', 'user', 'deliveryMan']);
        });
    }

    /**
     * An inactive employee cannot sign in to anything; reactivating restores the access their position gives.
     */
    private function syncAccess(Employee $employee, Position $position): void
    {
        $user = $employee->user;

        if (! $user || $user->hasRole('admin')) {
            return;
        }

        if (! $employee->isActive()) {
            $user->syncRoles([]);

            return;
        }

        if ($user->roles->isEmpty() && $position->system_role && $position->system_role !== 'admin') {
            $user->assignRole($position->system_role);
        }
    }

    /**
     * @param  array{email?: string|null, password?: string|null, role?: string|null}  $account
     */
    private function saveAccount(Employee $employee, Position $position, array $account): void
    {
        $email = $account['email'] ?? null;

        if (! $email) {
            return;
        }

        $role = $account['role'] ?? $position->system_role;
        $user = $employee->user;

        if ($user) {
            $user->forceFill(array_filter([
                'name' => $employee->full_name,
                'email' => $email,
                'password' => ! empty($account['password']) ? Hash::make($account['password']) : null,
            ]))->save();
        } else {
            $user = User::create([
                'name' => $employee->full_name,
                'email' => $email,
                'password' => Hash::make((string) $account['password']),
                'email_verified_at' => now(),
            ]);
            $employee->update(['user_id' => $user->id]);
        }

        if ($role && $role !== 'admin') {
            $user->syncRoles([$role]);
        }
    }
}
