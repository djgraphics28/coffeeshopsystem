<?php

namespace App\Actions\Hr;

use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\User;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Creates payroll runs (one payslip per active employee on that pay schedule) and keeps their figures up to date.
 */
class GeneratePayroll
{
    public function __construct(private readonly PayslipCalculator $calculator) {}

    /**
     * @throws DomainException when the period was already run or nobody is paid on that schedule
     */
    public function create(string $frequency, string $anchor, ?int $half, ?User $by = null, ?string $notes = null): PayrollRun
    {
        $period = PayrollPeriod::resolve($frequency, $anchor, $half);

        // Absences are counted over the whole period, so it must be over (today is allowed for a daily payroll).
        if ($period['end']->startOfDay()->greaterThan(CarbonImmutable::now()->startOfDay())) {
            throw new DomainException("This pay period has not finished yet — it ends on {$period['end']->format('M j, Y')}. Create the payroll on or after that day so absences are counted correctly.");
        }

        if (PayrollRun::where('reference', $period['reference'])->exists()) {
            throw new DomainException("A payroll for {$period['label']} already exists. Open it from the list, or delete it first if it is still a draft.");
        }

        $employees = $this->eligibleEmployees($frequency)->get();

        if ($employees->isEmpty()) {
            throw new DomainException('No active employees are paid '.str_replace('_', ' ', $frequency).'. Set an employee\'s pay schedule first.');
        }

        return DB::transaction(function () use ($frequency, $period, $employees, $by, $notes) {
            $run = PayrollRun::create([
                'reference' => $period['reference'],
                'frequency' => $frequency,
                'period_start' => $period['start']->toDateString(),
                'period_end' => $period['end']->toDateString(),
                'status' => 'draft',
                'notes' => $notes,
                'created_by' => $by?->id,
            ]);

            foreach ($employees as $employee) {
                $run->payslips()->create(['employee_id' => $employee->id] + $this->calculator->compute($employee, $period['start'], $period['end'], $frequency));
            }

            return $run;
        });
    }

    /**
     * Recomputes a draft from the latest attendance (and picks up newly eligible employees), keeping manual adjustments.
     */
    public function recalculate(PayrollRun $run): void
    {
        if (! $run->isDraft()) {
            throw new DomainException('Only a draft payroll can be recalculated.');
        }

        $start = CarbonImmutable::parse($run->period_start);
        $end = CarbonImmutable::parse($run->period_end)->endOfDay();

        DB::transaction(function () use ($run, $start, $end) {
            $existing = $run->payslips()->get()->keyBy('employee_id');

            foreach ($this->eligibleEmployees($run->frequency)->get() as $employee) {
                $figures = $this->calculator->compute($employee, $start, $end, $run->frequency);
                $payslip = $existing->get($employee->id);

                if ($payslip) {
                    $payslip->update($figures);
                    $this->refreshAdjustments($payslip);
                } else {
                    $this->refreshAdjustments($run->payslips()->create(['employee_id' => $employee->id] + $figures));
                }
            }

            // Employees who are no longer eligible (deactivated, moved to another schedule) keep their existing payslip.
            foreach ($existing as $employeeId => $payslip) {
                if (! $this->eligibleEmployees($run->frequency)->whereKey($employeeId)->exists()) {
                    $this->refreshAdjustments($payslip);
                }
            }
        });
    }

    /**
     * Re-adds the hand-entered earnings and deductions to a payslip and updates its totals.
     */
    public function refreshAdjustments(Payslip $payslip): Payslip
    {
        $payslip->load('adjustments');

        $earnings = (float) $payslip->adjustments->where('type', 'earning')->sum('amount');
        $other = (float) $payslip->adjustments->where('type', 'deduction')->sum('amount');

        $payslip->update($this->calculator->totals([
            'basic_pay' => $payslip->basic_pay,
            'overtime_pay' => $payslip->overtime_pay,
            'late_deduction' => $payslip->late_deduction,
            'absence_deduction' => $payslip->absence_deduction,
            'earnings' => $earnings,
            'other_deductions' => $other,
        ]));

        return $payslip->refresh();
    }

    /** @return Builder<Employee> */
    private function eligibleEmployees(string $frequency)
    {
        return Employee::active()->where('pay_frequency', $frequency)->with('position')->orderBy('first_name');
    }
}
