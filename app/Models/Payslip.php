<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payslip extends Model
{
    protected $fillable = [
        'payroll_run_id', 'employee_id', 'employee_name', 'employee_code', 'position', 'salary_type', 'base_salary',
        'daily_rate', 'hourly_rate', 'days_worked', 'expected_days', 'absent_days', 'worked_minutes', 'late_minutes',
        'overtime_minutes', 'incomplete_days', 'basic_pay', 'overtime_pay', 'earnings', 'late_deduction',
        'absence_deduction', 'other_deductions', 'gross_pay', 'total_deductions', 'net_pay',
    ];

    protected $casts = [
        'base_salary' => 'float',
        'daily_rate' => 'float',
        'hourly_rate' => 'float',
        'days_worked' => 'float',
        'expected_days' => 'float',
        'absent_days' => 'float',
        'basic_pay' => 'float',
        'overtime_pay' => 'float',
        'earnings' => 'float',
        'late_deduction' => 'float',
        'absence_deduction' => 'float',
        'other_deductions' => 'float',
        'gross_pay' => 'float',
        'total_deductions' => 'float',
        'net_pay' => 'float',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(PayslipAdjustment::class);
    }
}
