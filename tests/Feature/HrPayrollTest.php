<?php

use App\Actions\Hr\GeneratePayroll;
use App\Actions\Hr\PayrollPeriod;
use App\Actions\Hr\PayslipCalculator;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\Position;
use App\Models\Setting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\delete;
use function Pest\Laravel\get;
use function Pest\Laravel\post;
use function Pest\Laravel\put;

/**
 * Default rules: 26 working days a month, 8 hours a day, shift 08:00–17:00, 10 min grace, overtime x1.25.
 * A 15,600 monthly salary is therefore 600 a day and 75 an hour.
 */
beforeEach(function () {
    Carbon::setTestNow('2026-10-20 12:00:00');

    $this->cashier = Position::firstWhere('name', 'Cashier');
    $this->makeEmployee = fn (array $attributes = []) => Employee::create(array_merge([
        'employee_code' => 'EMP-'.str_pad((string) (Employee::count() + 1), 4, '0', STR_PAD_LEFT),
        'first_name' => 'Maria', 'last_name' => 'Santos', 'position_id' => $this->cashier->id,
        'pay_frequency' => 'monthly', 'salary_type' => 'monthly', 'base_salary' => 15600,
    ], $attributes));

    /** Adds a finished attendance day with the minutes the calculator reads. */
    $this->workedDay = fn (Employee $e, string $date, int $worked = 480, int $late = 0, int $overtime = 0) => Attendance::create([
        'employee_id' => $e->id, 'work_date' => $date, 'time_in' => "{$date} 08:00:00", 'time_out' => "{$date} 17:00:00",
        'worked_minutes' => $worked, 'late_minutes' => $late, 'overtime_minutes' => $overtime, 'source' => 'manual',
    ]);

    $this->calc = fn (Employee $e, string $frequency, string $start, string $end) => app(PayslipCalculator::class)
        ->compute($e, CarbonImmutable::parse($start), CarbonImmutable::parse($end)->endOfDay(), $frequency);
});

afterEach(fn () => Carbon::setTestNow());

describe('Pay periods', function () {
    it('resolves a daily period', function () {
        $p = PayrollPeriod::resolve('daily', '2026-10-05');

        expect($p['start']->toDateString())->toBe('2026-10-05')->and($p['end']->toDateString())->toBe('2026-10-05')
            ->and($p['reference'])->toBe('PR-D-20261005')->and($p['label'])->toBe('Mon, Oct 5, 2026');
    });

    it('resolves the two halves of a month around the configured cut-off', function () {
        $first = PayrollPeriod::resolve('half_month', '2026-10', 1);
        $second = PayrollPeriod::resolve('half_month', '2026-10', 2);

        expect($first['start']->toDateString())->toBe('2026-10-01')->and($first['end']->toDateString())->toBe('2026-10-15')
            ->and($second['start']->toDateString())->toBe('2026-10-16')->and($second['end']->toDateString())->toBe('2026-10-31')
            ->and($first['reference'])->toBe('PR-H-202610-1');

        Setting::set('hr_half_month_cutoff', '10');
        expect(PayrollPeriod::resolve('half_month', '2026-10', 1)['end']->toDateString())->toBe('2026-10-10')
            ->and(PayrollPeriod::resolve('half_month', '2026-10', 2)['start']->toDateString())->toBe('2026-10-11');
    });

    it('handles short months and resolves a whole month', function () {
        $feb = PayrollPeriod::resolve('half_month', '2026-02', 2);
        $month = PayrollPeriod::resolve('monthly', '2026-02');

        expect($feb['end']->toDateString())->toBe('2026-02-28')->and($month['start']->toDateString())->toBe('2026-02-01')
            ->and($month['end']->toDateString())->toBe('2026-02-28')->and($month['label'])->toBe('February 2026');
    });

    it('asks for a half when paying half-month', function () {
        expect(fn () => PayrollPeriod::resolve('half_month', '2026-10'))->toThrow(InvalidArgumentException::class);
    });
});

describe('Payslip calculation', function () {
    it('pays a daily-rated employee for each day worked', function () {
        $e = ($this->makeEmployee)(['salary_type' => 'daily', 'base_salary' => 600, 'pay_frequency' => 'half_month']);
        foreach (['2026-10-01', '2026-10-02', '2026-10-05'] as $d) {
            ($this->workedDay)($e, $d);
        }
        ($this->workedDay)($e, '2026-10-20'); // outside the period

        $p = ($this->calc)($e, 'half_month', '2026-10-01', '2026-10-15');

        expect($p['days_worked'])->toBe(3.0)->and($p['basic_pay'])->toBe(1800.0)->and($p['absence_deduction'])->toBe(0.0)
            ->and($p['gross_pay'])->toBe(1800.0)->and($p['net_pay'])->toBe(1800.0)->and($p['daily_rate'])->toBe(600.0);
    });

    it('gives a monthly-salary employee half the salary each half-month, minus absences', function () {
        $e = ($this->makeEmployee)(['pay_frequency' => 'half_month']);
        foreach (range(1, 11) as $day) { // 11 of the 13 expected days
            ($this->workedDay)($e, sprintf('2026-10-%02d', $day));
        }

        $p = ($this->calc)($e, 'half_month', '2026-10-01', '2026-10-15');

        expect($p['basic_pay'])->toBe(7800.0)->and($p['expected_days'])->toBe(13.0)->and($p['absent_days'])->toBe(2.0)
            ->and($p['absence_deduction'])->toBe(1200.0)->and($p['net_pay'])->toBe(6600.0);
    });

    it('pays a monthly salary in full when there are no absences', function () {
        $e = ($this->makeEmployee)();
        foreach (range(1, 26) as $n) {
            ($this->workedDay)($e, CarbonImmutable::parse('2026-09-01')->addDays($n - 1)->toDateString());
        }

        $p = ($this->calc)($e, 'monthly', '2026-09-01', '2026-09-30');

        expect($p['basic_pay'])->toBe(15600.0)->and($p['absence_deduction'])->toBe(0.0)->and($p['net_pay'])->toBe(15600.0);
    });

    it('pays a monthly-salary employee on a daily schedule per day worked', function () {
        $e = ($this->makeEmployee)(['pay_frequency' => 'daily']);
        ($this->workedDay)($e, '2026-10-05');

        $p = ($this->calc)($e, 'daily', '2026-10-05', '2026-10-05');

        expect($p['basic_pay'])->toBe(600.0)->and($p['absence_deduction'])->toBe(0.0)->and($p['expected_days'])->toBe(1.0);
    });

    it('pays nothing for a daily schedule when the employee did not work that day', function () {
        $e = ($this->makeEmployee)(['pay_frequency' => 'daily']);

        $p = ($this->calc)($e, 'daily', '2026-10-05', '2026-10-05');

        expect($p['basic_pay'])->toBe(0.0)->and($p['net_pay'])->toBe(0.0);
    });

    it('deducts lateness at the hourly rate and pays overtime at the multiplier', function () {
        $e = ($this->makeEmployee)(['salary_type' => 'daily', 'base_salary' => 600, 'pay_frequency' => 'daily']);
        ($this->workedDay)($e, '2026-10-05', 480, 30, 60);

        $p = ($this->calc)($e, 'daily', '2026-10-05', '2026-10-05');

        // hourly = 600 / 8 = 75; late 30 min = 37.50; overtime 60 min x 1.25 = 93.75
        expect($p['late_deduction'])->toBe(37.5)->and($p['overtime_pay'])->toBe(93.75)
            ->and($p['gross_pay'])->toBe(693.75)->and($p['net_pay'])->toBe(656.25);
    });

    it('can ignore lateness and overtime when switched off', function () {
        Setting::set('hr_deduct_late', '0');
        Setting::set('hr_overtime_enabled', '0');
        $e = ($this->makeEmployee)(['salary_type' => 'daily', 'base_salary' => 600, 'pay_frequency' => 'daily']);
        ($this->workedDay)($e, '2026-10-05', 480, 30, 60);

        $p = ($this->calc)($e, 'daily', '2026-10-05', '2026-10-05');

        expect($p['late_deduction'])->toBe(0.0)->and($p['overtime_pay'])->toBe(0.0)->and($p['net_pay'])->toBe(600.0);
    });

    it('follows the working days and hours set in the system', function () {
        Setting::set('hr_working_days_per_month', '30');
        Setting::set('hr_hours_per_day', '10');
        $e = ($this->makeEmployee)(['base_salary' => 15000, 'pay_frequency' => 'daily']);
        ($this->workedDay)($e, '2026-10-05');

        $p = ($this->calc)($e, 'daily', '2026-10-05', '2026-10-05');

        expect($p['daily_rate'])->toBe(500.0)->and($p['hourly_rate'])->toBe(50.0)->and($p['basic_pay'])->toBe(500.0);
    });

    it('flags days with no clock-out and does not pay them', function () {
        $e = ($this->makeEmployee)(['salary_type' => 'daily', 'base_salary' => 600, 'pay_frequency' => 'daily']);
        Attendance::create(['employee_id' => $e->id, 'work_date' => '2026-10-05', 'time_in' => '2026-10-05 08:00:00', 'source' => 'kiosk']);

        $p = ($this->calc)($e, 'daily', '2026-10-05', '2026-10-05');

        expect($p['incomplete_days'])->toBe(1)->and($p['days_worked'])->toBe(0.0)->and($p['basic_pay'])->toBe(0.0);
    });

    it('never produces negative pay', function () {
        $totals = app(PayslipCalculator::class)->totals(['basic_pay' => 100, 'overtime_pay' => 0, 'earnings' => 0, 'late_deduction' => 0, 'absence_deduction' => 0, 'other_deductions' => 500]);

        expect($totals['net_pay'])->toBe(0.0)->and($totals['total_deductions'])->toBe(500.0);
    });
});

describe('Payroll runs', function () {
    it('creates a draft with a payslip for every active employee on that pay schedule only', function () {
        $half = ($this->makeEmployee)(['first_name' => 'Half', 'pay_frequency' => 'half_month']);
        ($this->makeEmployee)(['first_name' => 'Monthly', 'pay_frequency' => 'monthly']);
        ($this->makeEmployee)(['first_name' => 'Gone', 'pay_frequency' => 'half_month', 'status' => 'inactive']);

        $run = app(GeneratePayroll::class)->create('half_month', '2026-10', 1);

        expect($run->status)->toBe('draft')->and($run->reference)->toBe('PR-H-202610-1')
            ->and($run->payslips()->count())->toBe(1)->and($run->payslips()->first()->employee_id)->toBe($half->id);
    });

    it('refuses a duplicate period and an empty schedule', function () {
        ($this->makeEmployee)(['pay_frequency' => 'monthly']);
        app(GeneratePayroll::class)->create('monthly', '2026-09', null);

        expect(fn () => app(GeneratePayroll::class)->create('monthly', '2026-09', null))->toThrow(DomainException::class, 'already exists');
        expect(fn () => app(GeneratePayroll::class)->create('daily', '2026-10-05', null))->toThrow(DomainException::class, 'No active employees');
    });

    it('recalculates from new attendance but keeps the manual adjustments', function () {
        $e = ($this->makeEmployee)(['salary_type' => 'daily', 'base_salary' => 600, 'pay_frequency' => 'daily']);
        $run = app(GeneratePayroll::class)->create('daily', '2026-10-05', null);
        $payslip = $run->payslips()->first();
        $payslip->adjustments()->create(['type' => 'earning', 'label' => 'Meal allowance', 'amount' => 100]);
        app(GeneratePayroll::class)->refreshAdjustments($payslip);
        expect($payslip->fresh()->net_pay)->toBe(100.0);

        ($this->workedDay)($e, '2026-10-05');
        app(GeneratePayroll::class)->recalculate($run);

        $fresh = $run->payslips()->first();
        expect($fresh->basic_pay)->toBe(600.0)->and($fresh->earnings)->toBe(100.0)->and($fresh->net_pay)->toBe(700.0)
            ->and($run->payslips()->count())->toBe(1);
    });

    it('picks up an employee added after the draft was created when recalculated', function () {
        ($this->makeEmployee)(['first_name' => 'First', 'pay_frequency' => 'monthly']);
        $run = app(GeneratePayroll::class)->create('monthly', '2026-09', null);

        ($this->makeEmployee)(['first_name' => 'Second', 'pay_frequency' => 'monthly']);
        app(GeneratePayroll::class)->recalculate($run);

        expect($run->payslips()->count())->toBe(2);
    });

    it('will not create a payroll for a period that has not finished', function () {
        ($this->makeEmployee)(['pay_frequency' => 'half_month']);

        // "Now" is 20 Oct: the 2nd half of October (16–31) is still running, the 1st half is over.
        expect(fn () => app(GeneratePayroll::class)->create('half_month', '2026-10', 2))->toThrow(DomainException::class, 'has not finished yet');
        expect(app(GeneratePayroll::class)->create('half_month', '2026-10', 1)->status)->toBe('draft');
    });

    it('allows a daily payroll for today but not tomorrow', function () {
        ($this->makeEmployee)(['pay_frequency' => 'daily']);

        expect(app(GeneratePayroll::class)->create('daily', '2026-10-20', null)->reference)->toBe('PR-D-20261020');
        expect(fn () => app(GeneratePayroll::class)->create('daily', '2026-10-21', null))->toThrow(DomainException::class);
    });

    it('only expects and pays someone from the day they were hired', function () {
        // Hired 8 Oct: 8 of the 15 days of the 1st half. Salary 15,600 → half is 7,800; 8/15 of that is 4,160.
        $e = ($this->makeEmployee)(['pay_frequency' => 'half_month', 'hire_date' => '2026-10-08']);
        foreach (range(8, 15) as $day) {
            ($this->workedDay)($e, sprintf('2026-10-%02d', $day));
        }

        $p = ($this->calc)($e, 'half_month', '2026-10-01', '2026-10-15');

        expect($p['basic_pay'])->toBe(4160.0)->and($p['expected_days'])->toBe(6.93)->and($p['absent_days'])->toBe(0.0)->and($p['net_pay'])->toBe(4160.0);
    });

    it('does not penalise a monthly employee for days before they were hired', function () {
        $e = ($this->makeEmployee)(['pay_frequency' => 'monthly', 'hire_date' => '2026-09-16']);
        foreach (range(16, 28) as $day) { // 13 working days of the second half
            ($this->workedDay)($e, sprintf('2026-09-%02d', $day));
        }

        $p = ($this->calc)($e, 'monthly', '2026-09-01', '2026-09-30');

        expect($p['absence_deduction'])->toBe(0.0)->and($p['basic_pay'])->toBe(7800.0);
    });

    it('does not let an approved payroll be recalculated', function () {
        ($this->makeEmployee)();
        $run = app(GeneratePayroll::class)->create('monthly', '2026-09', null);
        $run->update(['status' => 'approved']);

        expect(fn () => app(GeneratePayroll::class)->recalculate($run))->toThrow(DomainException::class);
    });
});

describe('Payroll screens (admin)', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        actingAs($this->admin);
    });

    it('lists runs and how many employees are on each pay schedule', function () {
        ($this->makeEmployee)(['pay_frequency' => 'daily']);
        ($this->makeEmployee)(['pay_frequency' => 'monthly']);
        ($this->makeEmployee)(['pay_frequency' => 'monthly']);

        get(route('admin.hr.payroll.index'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('Admin/Hr/Payroll/Index')
            ->where('employee_counts.daily', 1)->where('employee_counts.monthly', 2)->where('employee_counts.half_month', 0)
            ->where('settings.hr_working_days_per_month', '26'));
    });

    it('creates a payroll and opens it', function () {
        ($this->makeEmployee)(['pay_frequency' => 'half_month']);

        post(route('admin.hr.payroll.store'), ['frequency' => 'half_month', 'anchor' => '2026-10', 'half' => 1])
            ->assertRedirect(route('admin.hr.payroll.show', PayrollRun::first()));

        get(route('admin.hr.payroll.show', PayrollRun::first()))->assertOk()->assertInertia(fn ($page) => $page
            ->component('Admin/Hr/Payroll/Show')->has('payslips', 1)->where('run.label', 'Oct 1 – Oct 15, 2026'));
    });

    it('explains why a payroll could not be created', function () {
        post(route('admin.hr.payroll.store'), ['frequency' => 'daily', 'anchor' => '2026-10-05'])->assertSessionHas('error');
        post(route('admin.hr.payroll.store'), ['frequency' => 'half_month', 'anchor' => '2026-10'])->assertSessionHasErrors('half');
        post(route('admin.hr.payroll.store'), ['frequency' => 'monthly', 'anchor' => 'garbage'])->assertSessionHas('error');
        expect(PayrollRun::count())->toBe(0);
    });

    it('walks a payroll through draft, approved and paid, locking it on the way', function () {
        ($this->makeEmployee)(['pay_frequency' => 'monthly']);
        $run = app(GeneratePayroll::class)->create('monthly', '2026-09', null);
        $payslip = $run->payslips()->first();

        post(route('admin.hr.payroll.pay', $run))->assertSessionHas('error'); // not approved yet

        post(route('admin.hr.payroll.approve', $run))->assertSessionHas('success');
        expect($run->fresh()->status)->toBe('approved')->and($run->fresh()->approved_by)->toBe($this->admin->id);

        post(route('admin.hr.payroll.adjustments.store', $payslip), ['type' => 'earning', 'label' => 'Bonus', 'amount' => 500])->assertSessionHas('error');
        post(route('admin.hr.payroll.recalculate', $run))->assertSessionHas('error');
        delete(route('admin.hr.payroll.destroy', $run))->assertSessionHas('error');

        post(route('admin.hr.payroll.pay', $run), ['pay_date' => '2026-10-01'])->assertSessionHas('success');
        expect($run->fresh()->status)->toBe('paid')->and($run->fresh()->pay_date->toDateString())->toBe('2026-10-01');
        expect(PayrollRun::count())->toBe(1);
    });

    it('adds and removes earnings and deductions on a draft', function () {
        ($this->makeEmployee)(['salary_type' => 'daily', 'base_salary' => 1000, 'pay_frequency' => 'daily']);
        ($this->workedDay)(Employee::first(), '2026-10-05');
        $run = app(GeneratePayroll::class)->create('daily', '2026-10-05', null);
        $payslip = $run->payslips()->first();

        post(route('admin.hr.payroll.adjustments.store', $payslip), ['type' => 'earning', 'label' => 'Allowance', 'amount' => 200])->assertSessionHasNoErrors();
        post(route('admin.hr.payroll.adjustments.store', $payslip), ['type' => 'deduction', 'label' => 'Cash advance', 'amount' => 150.5])->assertSessionHasNoErrors();

        $p = $payslip->fresh();
        expect($p->earnings)->toBe(200.0)->and($p->other_deductions)->toBe(150.5)->and($p->gross_pay)->toBe(1200.0)->and($p->net_pay)->toBe(1049.5);

        delete(route('admin.hr.payroll.adjustments.destroy', $p->adjustments()->where('type', 'deduction')->first()));
        expect($payslip->fresh()->net_pay)->toBe(1200.0);

        post(route('admin.hr.payroll.adjustments.store', $payslip), ['type' => 'bonus', 'label' => '', 'amount' => -5])
            ->assertSessionHasErrors(['type', 'label', 'amount']);
    });

    it('deletes a draft payroll', function () {
        ($this->makeEmployee)();
        $run = app(GeneratePayroll::class)->create('monthly', '2026-09', null);

        delete(route('admin.hr.payroll.destroy', $run))->assertRedirect(route('admin.hr.payroll.index'));
        expect(PayrollRun::count())->toBe(0);
    });

    it('opens a printable payslip and rejects one from another payroll', function () {
        ($this->makeEmployee)();
        $run = app(GeneratePayroll::class)->create('monthly', '2026-09', null);
        ($this->makeEmployee)(['pay_frequency' => 'daily']);
        $other = app(GeneratePayroll::class)->create('daily', '2026-10-05', null);

        get(route('admin.hr.payroll.payslip', [$run, $run->payslips()->first()]))->assertOk()->assertInertia(fn ($page) => $page->component('Admin/Hr/Payroll/Payslip'));
        get(route('admin.hr.payroll.payslip', [$run, $other->payslips()->first()]))->assertNotFound();
    });

    it('saves the payroll settings and validates them', function () {
        put(route('admin.hr.payroll.settings'), [
            'hr_default_pay_frequency' => 'half_month', 'hr_working_days_per_month' => 24, 'hr_hours_per_day' => 9, 'hr_unpaid_break_minutes' => 30,
            'hr_default_shift_start' => '09:00', 'hr_default_shift_end' => '18:00', 'hr_late_grace_minutes' => 5, 'hr_deduct_late' => false,
            'hr_overtime_enabled' => true, 'hr_overtime_multiplier' => 1.5, 'hr_half_month_cutoff' => 14, 'hr_attendance_enabled' => true,
        ])->assertSessionHasNoErrors();

        expect(Setting::get('hr_default_pay_frequency'))->toBe('half_month')->and(Setting::get('hr_working_days_per_month'))->toBe('24')
            ->and(Setting::get('hr_deduct_late'))->toBe('0')->and(Setting::get('hr_overtime_multiplier'))->toBe('1.5');

        put(route('admin.hr.payroll.settings'), ['hr_default_pay_frequency' => 'weekly', 'hr_working_days_per_month' => 99])
            ->assertSessionHasErrors(['hr_default_pay_frequency', 'hr_working_days_per_month']);
    });

    it('is limited to people with the payroll permissions', function () {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');
        actingAs($cashier);

        get(route('admin.hr.payroll.index'))->assertForbidden();
        post(route('admin.hr.payroll.store'), ['frequency' => 'monthly', 'anchor' => '2026-09'])->assertForbidden();
    });
});
