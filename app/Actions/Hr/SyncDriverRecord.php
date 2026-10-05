<?php

namespace App\Actions\Hr;

use App\Models\DeliveryMan;
use App\Models\Employee;

/**
 * Keeps the delivery men list in step with the employees: an active employee in a driver position gets (and keeps)
 * a matching delivery man record; anyone who stops being an active driver is switched off, never deleted, so past
 * deliveries keep their history.
 */
class SyncDriverRecord
{
    public function handle(Employee $employee): ?DeliveryMan
    {
        $employee->loadMissing('position');
        $deliveryMan = $employee->deliveryMan()->first();

        if ($employee->position?->is_driver && $employee->isActive()) {
            $deliveryMan ??= new DeliveryMan(['employee_id' => $employee->id]);

            $deliveryMan->fill([
                'name' => $employee->full_name,
                'phone' => $employee->phone,
                'vehicle' => $employee->vehicle,
                'is_active' => true,
            ]);

            // The employee's system login doubles as the driver-app login.
            if ($employee->user_id) {
                $deliveryMan->user_id = $employee->user_id;
                $employee->user?->assignRole('driver');
            }

            $deliveryMan->save();

            return $deliveryMan;
        }

        $deliveryMan?->update(['is_active' => false]);

        return $deliveryMan;
    }
}
