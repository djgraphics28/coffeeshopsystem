<?php

namespace App\Http\Controllers\Admin\Hr;

use App\Actions\Hr\GeneratePayroll;
use App\Actions\Hr\HrSettings;
use App\Actions\Hr\PayrollPeriod;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\PayslipAdjustment;
use App\Models\Setting;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class PayrollController extends Controller
{
    public function __construct(private readonly GeneratePayroll $payroll) {}

    public function index(): Response
    {
        Gate::authorize('view payroll');

        return Inertia::render('Admin/Hr/Payroll/Index', [
            'runs' => PayrollRun::withCount('payslips')->withSum('payslips as gross_total', 'gross_pay')->withSum('payslips as net_total', 'net_pay')
                ->orderByDesc('period_start')->orderByDesc('id')->get()
                ->map(fn (PayrollRun $r) => $this->presentRun($r)),
            'employee_counts' => collect(Employee::FREQUENCIES)->mapWithKeys(fn (string $f) => [$f => Employee::active()->where('pay_frequency', $f)->count()]),
            'settings' => HrSettings::all(),
            'can' => ['manage' => Auth::user()?->can('manage payroll') ?? false],
            'currency' => Setting::get('currency', '₱'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manage payroll');

        $validated = $request->validate([
            'frequency' => ['required', Rule::in(Employee::FREQUENCIES)],
            'anchor' => ['required', 'string', 'max:10'],
            'half' => ['nullable', 'required_if:frequency,half_month', 'integer', 'in:1,2'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], ['half.required_if' => 'Choose the 1st or 2nd half of the month.']);

        try {
            PayrollPeriod::resolve($validated['frequency'], $validated['anchor'], $validated['half'] ?? null);
            $run = $this->payroll->create($validated['frequency'], $validated['anchor'], $validated['half'] ?? null, $request->user(), $validated['notes'] ?? null);
        } catch (DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        } catch (Throwable) {
            return redirect()->back()->with('error', 'That pay period is not valid. Please check the date and try again.');
        }

        return redirect()->route('admin.hr.payroll.show', $run)->with('success', 'Payroll created. Review the payslips, then approve it.');
    }

    public function show(PayrollRun $run): Response
    {
        Gate::authorize('view payroll');

        $run->load(['payslips.adjustments', 'creator:id,name']);

        return Inertia::render('Admin/Hr/Payroll/Show', [
            'run' => $this->presentRun($run->loadCount('payslips')),
            'payslips' => $run->payslips->sortBy('employee_name')->values()->map(fn (Payslip $p) => $this->presentPayslip($p)),
            'totals' => [
                'gross' => round((float) $run->payslips->sum('gross_pay'), 2),
                'deductions' => round((float) $run->payslips->sum('total_deductions'), 2),
                'net' => round((float) $run->payslips->sum('net_pay'), 2),
                'incomplete' => (int) $run->payslips->sum('incomplete_days'),
            ],
            'can' => ['manage' => Auth::user()?->can('manage payroll') ?? false],
            'currency' => Setting::get('currency', '₱'),
        ]);
    }

    public function recalculate(PayrollRun $run): RedirectResponse
    {
        Gate::authorize('manage payroll');

        try {
            $this->payroll->recalculate($run);
        } catch (DomainException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Payroll recalculated from the latest attendance.');
    }

    public function approve(Request $request, PayrollRun $run): RedirectResponse
    {
        Gate::authorize('manage payroll');

        if (! $run->isDraft()) {
            return redirect()->back()->with('error', 'Only a draft payroll can be approved.');
        }

        $run->update(['status' => 'approved', 'approved_by' => $request->user()->id, 'approved_at' => now()]);

        return redirect()->back()->with('success', 'Payroll approved. Figures are now locked.');
    }

    public function pay(Request $request, PayrollRun $run): RedirectResponse
    {
        Gate::authorize('manage payroll');

        if ($run->status !== 'approved') {
            return redirect()->back()->with('error', 'Approve the payroll before marking it as paid.');
        }

        $validated = $request->validate(['pay_date' => ['nullable', 'date']]);

        $run->update(['status' => 'paid', 'pay_date' => $validated['pay_date'] ?? now()->toDateString(), 'paid_at' => now()]);

        return redirect()->back()->with('success', 'Payroll marked as paid.');
    }

    public function destroy(PayrollRun $run): RedirectResponse
    {
        Gate::authorize('manage payroll');

        if (! $run->isDraft()) {
            return redirect()->back()->with('error', 'Only a draft payroll can be deleted.');
        }

        $run->delete();

        return redirect()->route('admin.hr.payroll.index')->with('success', 'Draft payroll deleted.');
    }

    public function addAdjustment(Request $request, Payslip $payslip): RedirectResponse
    {
        Gate::authorize('manage payroll');

        if (! $payslip->run->isDraft()) {
            return redirect()->back()->with('error', 'This payroll is locked. Adjustments can only be changed on a draft.');
        }

        $validated = $request->validate([
            'type' => ['required', Rule::in(['earning', 'deduction'])],
            'label' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:9999999'],
        ]);

        $payslip->adjustments()->create($validated);
        $this->payroll->refreshAdjustments($payslip);

        return redirect()->back()->with('success', 'Adjustment added.');
    }

    public function deleteAdjustment(PayslipAdjustment $adjustment): RedirectResponse
    {
        Gate::authorize('manage payroll');

        $payslip = $adjustment->payslip;

        if (! $payslip->run->isDraft()) {
            return redirect()->back()->with('error', 'This payroll is locked. Adjustments can only be changed on a draft.');
        }

        $adjustment->delete();
        $this->payroll->refreshAdjustments($payslip);

        return redirect()->back()->with('success', 'Adjustment removed.');
    }

    /** One payslip laid out for printing. */
    public function payslip(PayrollRun $run, Payslip $payslip): Response
    {
        Gate::authorize('view payroll');
        abort_unless($payslip->payroll_run_id === $run->id, 404);

        return Inertia::render('Admin/Hr/Payroll/Payslip', [
            'run' => $this->presentRun($run),
            'payslip' => $this->presentPayslip($payslip->load('adjustments')),
            'cafe_name' => Setting::get('cafe_name', config('app.name')),
            'currency' => Setting::get('currency', '₱'),
        ]);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        Gate::authorize('manage payroll');

        $validated = $request->validate([
            'hr_default_pay_frequency' => ['required', Rule::in(Employee::FREQUENCIES)],
            'hr_working_days_per_month' => ['required', 'numeric', 'min:1', 'max:31'],
            'hr_hours_per_day' => ['required', 'numeric', 'min:1', 'max:24'],
            'hr_unpaid_break_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'hr_default_shift_start' => ['required', 'date_format:H:i'],
            'hr_default_shift_end' => ['required', 'date_format:H:i'],
            'hr_late_grace_minutes' => ['required', 'integer', 'min:0', 'max:120'],
            'hr_deduct_late' => ['boolean'],
            'hr_overtime_enabled' => ['boolean'],
            'hr_overtime_multiplier' => ['required', 'numeric', 'min:1', 'max:5'],
            'hr_half_month_cutoff' => ['required', 'integer', 'min:1', 'max:28'],
            'hr_attendance_enabled' => ['boolean'],
        ]);

        foreach (['hr_deduct_late', 'hr_overtime_enabled', 'hr_attendance_enabled'] as $flag) {
            $validated[$flag] = $request->boolean($flag) ? '1' : '0';
        }

        foreach ($validated as $key => $value) {
            Setting::set($key, (string) $value);
        }

        return redirect()->back()->with('success', 'Payroll settings saved. They apply to new and recalculated payrolls.');
    }

    /**
     * @return array<string, mixed>
     */
    private function presentRun(PayrollRun $r): array
    {
        $label = PayrollPeriod::resolve(
            $r->frequency,
            $r->frequency === 'daily' ? $r->period_start->toDateString() : $r->period_start->format('Y-m'),
            $r->frequency === 'half_month' ? ($r->period_start->day === 1 ? 1 : 2) : null,
        )['label'];

        return [
            'id' => $r->id,
            'reference' => $r->reference,
            'frequency' => $r->frequency,
            'period_start' => $r->period_start->toDateString(),
            'period_end' => $r->period_end->toDateString(),
            'label' => $label,
            'status' => $r->status,
            'pay_date' => $r->pay_date?->toDateString(),
            'notes' => $r->notes,
            'payslips_count' => $r->payslips_count ?? null,
            'gross_total' => isset($r->gross_total) ? round((float) $r->gross_total, 2) : null,
            'net_total' => isset($r->net_total) ? round((float) $r->net_total, 2) : null,
            'created_by' => $r->relationLoaded('creator') ? $r->creator?->name : null,
            'approved_at' => $r->approved_at?->toDateTimeString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentPayslip(Payslip $p): array
    {
        return [
            ...$p->only([
                'id', 'employee_id', 'employee_name', 'employee_code', 'position', 'salary_type', 'base_salary', 'daily_rate', 'hourly_rate',
                'days_worked', 'expected_days', 'absent_days', 'worked_minutes', 'late_minutes', 'overtime_minutes', 'incomplete_days',
                'basic_pay', 'overtime_pay', 'earnings', 'late_deduction', 'absence_deduction', 'other_deductions', 'gross_pay',
                'total_deductions', 'net_pay',
            ]),
            'adjustments' => $p->relationLoaded('adjustments')
                ? $p->adjustments->map(fn ($a) => ['id' => $a->id, 'type' => $a->type, 'label' => $a->label, 'amount' => $a->amount])->values()
                : [],
        ];
    }
}
