<?php

namespace App\Actions\Hr;

use App\Models\Attendance;
use App\Models\Employee;
use Carbon\CarbonImmutable;

/**
 * Works out one employee's pay for a period from their attendance and the payroll rules in the HR settings.
 *
 * - Daily-rated staff earn their daily rate for every day worked.
 * - Monthly-rated staff paid monthly or half-month get their (half) salary, minus a deduction for absences.
 * - Monthly-rated staff paid daily earn daily rate (salary ÷ working days per month) for every day worked.
 * - Lateness is deducted (if enabled) and overtime is paid at a multiplier (if enabled).
 * Allowances / deductions entered by hand are added afterwards (see applyAdjustments).
 */
class PayslipCalculator
{
    /**
     * @return array<string, mixed> payslip columns (without the run / employee ids)
     */
    public function compute(Employee $employee, CarbonImmutable $start, CarbonImmutable $end, string $frequency): array
    {
        $employee->loadMissing('position');

        $workingDays = max(1.0, HrSettings::number('hr_working_days_per_month'));
        $hoursPerDay = max(1.0, HrSettings::number('hr_hours_per_day'));

        $dailyRate = $employee->salary_type === 'daily' ? $employee->base_salary : $employee->base_salary / $workingDays;
        $hourlyRate = $dailyRate / $hoursPerDay;

        $records = Attendance::where('employee_id', $employee->id)
            ->whereDate('work_date', '>=', $start->toDateString())
            ->whereDate('work_date', '<=', $end->toDateString())
            ->get();

        $completed = $records->whereNotNull('time_out')->where('worked_minutes', '>', 0);
        $daysWorked = (float) $completed->count();
        $incomplete = $records->whereNull('time_out')->count();
        $lateMinutes = (int) $records->sum('late_minutes');
        $overtimeMinutes = (int) $records->sum('overtime_minutes');

        // Someone hired part-way through the period is only expected (and, on a fixed salary, only paid) from their hire date.
        $share = $this->activeShare($employee, $start, $end);

        $expectedDays = match ($frequency) {
            'daily' => 1.0,
            'half_month' => $workingDays / 2,
            default => $workingDays,
        } * $share;
        $absentDays = max(0.0, $expectedDays - $daysWorked);

        // Monthly salary paid per period keeps its fixed share and loses pay for absences; everything else is per day worked.
        $fixedSalary = $employee->salary_type === 'monthly' && $frequency !== 'daily';

        $basic = $fixedSalary
            ? ($frequency === 'half_month' ? $employee->base_salary / 2 : $employee->base_salary) * $share
            : $dailyRate * $daysWorked;

        $absenceDeduction = $fixedSalary ? $absentDays * $dailyRate : 0.0;
        $lateDeduction = HrSettings::flag('hr_deduct_late') ? $lateMinutes * ($hourlyRate / 60) : 0.0;
        $overtimePay = HrSettings::flag('hr_overtime_enabled')
            ? $overtimeMinutes * ($hourlyRate / 60) * HrSettings::number('hr_overtime_multiplier')
            : 0.0;

        $attributes = [
            'employee_name' => $employee->full_name,
            'employee_code' => $employee->employee_code,
            'position' => $employee->position?->name,
            'salary_type' => $employee->salary_type,
            'base_salary' => $employee->base_salary,
            'daily_rate' => round($dailyRate, 2),
            'hourly_rate' => round($hourlyRate, 4),
            'days_worked' => $daysWorked,
            'expected_days' => round($expectedDays, 2),
            'absent_days' => round($absentDays, 2),
            'worked_minutes' => (int) $completed->sum('worked_minutes'),
            'late_minutes' => $lateMinutes,
            'overtime_minutes' => $overtimeMinutes,
            'incomplete_days' => $incomplete,
            'basic_pay' => round($basic, 2),
            'overtime_pay' => round($overtimePay, 2),
            'late_deduction' => round($lateDeduction, 2),
            'absence_deduction' => round($absenceDeduction, 2),
        ];

        return $attributes + $this->totals($attributes + ['earnings' => 0.0, 'other_deductions' => 0.0]);
    }

    /**
     * The fraction of the period the employee was employed for (1.0 unless they were hired after it started).
     */
    private function activeShare(Employee $employee, CarbonImmutable $start, CarbonImmutable $end): float
    {
        if (! $employee->hire_date || $employee->hire_date->startOfDay()->lessThanOrEqualTo($start->startOfDay())) {
            return 1.0;
        }

        $hired = CarbonImmutable::instance($employee->hire_date)->startOfDay();

        if ($hired->greaterThan($end)) {
            return 0.0;
        }

        $periodDays = $start->startOfDay()->diffInDays($end->startOfDay()) + 1;

        return min(1.0, ($hired->diffInDays($end->startOfDay()) + 1) / $periodDays);
    }

    /**
     * Gross, total deductions and net from the individual lines.
     *
     * @param  array<string, mixed>  $p  needs basic_pay, overtime_pay, earnings, late_deduction, absence_deduction, other_deductions
     * @return array{earnings: float, other_deductions: float, gross_pay: float, total_deductions: float, net_pay: float}
     */
    public function totals(array $p): array
    {
        $gross = round($p['basic_pay'] + $p['overtime_pay'] + $p['earnings'], 2);
        $deductions = round($p['late_deduction'] + $p['absence_deduction'] + $p['other_deductions'], 2);

        return [
            'earnings' => round((float) $p['earnings'], 2),
            'other_deductions' => round((float) $p['other_deductions'], 2),
            'gross_pay' => $gross,
            'total_deductions' => $deductions,
            'net_pay' => max(0.0, round($gross - $deductions, 2)),
        ];
    }
}
