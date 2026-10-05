<?php

namespace App\Http\Controllers\Admin\Hr;

use App\Actions\Hr\HrSettings;
use App\Actions\Hr\MatchFace;
use App\Actions\Hr\SaveEmployee;
use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Position;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class EmployeeController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('view employees');

        $query = Employee::with(['position:id,name,is_driver', 'user:id,email', 'deliveryMan:id,employee_id'])
            ->orderBy('first_name')->orderBy('last_name');

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(fn ($q) => $q->where('first_name', 'like', $term)->orWhere('last_name', 'like', $term)
                ->orWhere('employee_code', 'like', $term)->orWhere('phone', 'like', $term));
        }

        foreach (['position_id', 'status', 'pay_frequency'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }

        $employees = $query->get();

        return Inertia::render('Admin/Hr/Employees/Index', [
            'employees' => $employees->map(fn (Employee $e) => $this->present($e))->values(),
            'positions' => Position::withCount('employees')->orderBy('name')->get(),
            'roles' => Role::where('name', '!=', 'admin')->orderBy('name')->pluck('name'),
            'filters' => $request->only(['search', 'position_id', 'status', 'pay_frequency']),
            'stats' => [
                'total' => Employee::count(),
                'active' => Employee::active()->count(),
                'drivers' => Employee::active()->whereHas('position', fn ($q) => $q->where('is_driver', true))->count(),
                'with_login' => Employee::whereNotNull('user_id')->count(),
            ],
            'defaults' => [
                'pay_frequency' => HrSettings::get('hr_default_pay_frequency'),
                'shift_start' => HrSettings::get('hr_default_shift_start'),
                'shift_end' => HrSettings::get('hr_default_shift_end'),
            ],
            'can' => ['manage' => Auth::user()?->can('manage employees') ?? false],
            'currency' => Setting::get('currency', '₱'),
        ]);
    }

    /** Printable ID cards (with the QR code used to clock in) for every active employee. */
    public function cards(): Response
    {
        Gate::authorize('view employees');

        return Inertia::render('Admin/Hr/Employees/Cards', [
            'employees' => Employee::active()->with('position:id,name')->orderBy('first_name')->get()
                ->map(fn (Employee $e) => ['id' => $e->id, 'code' => $e->employee_code, 'name' => $e->full_name, 'position' => $e->position?->name]),
            'cafe_name' => Setting::get('cafe_name', config('app.name')),
        ]);
    }

    public function store(Request $request, SaveEmployee $save): RedirectResponse
    {
        Gate::authorize('manage employees');

        [$data, $account] = $this->validated($request);
        $employee = $save->handle($data, $account);

        return redirect()->back()->with('success', "{$employee->full_name} added as {$employee->employee_code}.");
    }

    public function update(Request $request, Employee $employee, SaveEmployee $save): RedirectResponse
    {
        Gate::authorize('manage employees');

        [$data, $account] = $this->validated($request, $employee);
        $save->handle($data, $account, $employee);

        return redirect()->back()->with('success', 'Employee updated.');
    }

    public function destroy(Employee $employee): RedirectResponse
    {
        Gate::authorize('manage employees');

        if ($employee->attendances()->exists() || $employee->payslips()->exists()) {
            return redirect()->back()->with('error', 'This employee has attendance or payroll history, so they cannot be deleted. Set them to Inactive instead.');
        }

        $employee->deliveryMan?->update(['is_active' => false]);

        if ($employee->user && ! $employee->user->hasRole('admin')) {
            $employee->user->delete();
        }

        $employee->delete();

        return redirect()->back()->with('success', 'Employee deleted.');
    }

    /** Saves the face samples (1024-number face embeddings computed in the browser) used for face attendance. */
    public function enrollFace(Request $request, Employee $employee): RedirectResponse
    {
        Gate::authorize('manage employees');

        $validated = $request->validate([
            'descriptors' => ['required', 'array', 'min:3', 'max:10'],
            'descriptors.*' => ['required', 'array', 'size:'.MatchFace::DESCRIPTOR_SIZE],
            'descriptors.*.*' => ['required', 'numeric', 'between:-100,100'],
        ]);

        $employee->update([
            'face_descriptors' => array_map(fn (array $d) => array_map('floatval', $d), array_values($validated['descriptors'])),
            'face_enrolled_at' => now(),
        ]);

        return redirect()->back()->with('success', "Face registered for {$employee->full_name}.");
    }

    public function removeFace(Employee $employee): RedirectResponse
    {
        Gate::authorize('manage employees');

        $employee->update(['face_descriptors' => null, 'face_enrolled_at' => null]);

        return redirect()->back()->with('success', "Face data removed for {$employee->full_name}.");
    }

    /**
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function validated(Request $request, ?Employee $employee = null): array
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'hire_date' => ['nullable', 'date'],
            'position_id' => ['required', Rule::exists('positions', 'id')],
            'status' => ['required', Rule::in(Employee::STATUSES)],
            'pay_frequency' => ['required', Rule::in(Employee::FREQUENCIES)],
            'salary_type' => ['required', Rule::in(Employee::SALARY_TYPES)],
            'base_salary' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'shift_start' => ['nullable', 'date_format:H:i'],
            'shift_end' => ['nullable', 'date_format:H:i'],
            'vehicle' => ['nullable', 'string', 'max:100'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'create_login' => ['boolean'],
            'account_email' => ['nullable', 'required_if:create_login,true', 'email', 'max:255', Rule::unique('users', 'email')->ignore($employee?->user_id)],
            'account_password' => [$employee?->user_id ? 'nullable' : 'required_if:create_login,true', 'nullable', 'string', 'min:8', 'max:100'],
            'account_role' => ['nullable', Rule::exists('roles', 'name')->whereNot('name', 'admin')],
        ], [
            'account_email.required_if' => 'Enter the email the employee will sign in with.',
            'account_password.required_if' => 'Set a password (at least 8 characters) for the new login.',
        ]);

        $account = ! empty($validated['create_login'])
            ? ['email' => $validated['account_email'] ?? null, 'password' => $validated['account_password'] ?? null, 'role' => $validated['account_role'] ?? null]
            : [];

        unset($validated['create_login'], $validated['account_email'], $validated['account_password'], $validated['account_role']);

        return [$validated, $account];
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Employee $e): array
    {
        return [
            'id' => $e->id,
            'employee_code' => $e->employee_code,
            'first_name' => $e->first_name,
            'last_name' => $e->last_name,
            'full_name' => $e->full_name,
            'email' => $e->email,
            'phone' => $e->phone,
            'address' => $e->address,
            'birth_date' => $e->birth_date?->toDateString(),
            'hire_date' => $e->hire_date?->toDateString(),
            'position_id' => $e->position_id,
            'position' => $e->position ? ['id' => $e->position->id, 'name' => $e->position->name, 'is_driver' => $e->position->is_driver] : null,
            'status' => $e->status,
            'pay_frequency' => $e->pay_frequency,
            'salary_type' => $e->salary_type,
            'base_salary' => $e->base_salary,
            'shift_start' => $e->shift_start ? substr($e->shift_start, 0, 5) : null,
            'shift_end' => $e->shift_end ? substr($e->shift_end, 0, 5) : null,
            'vehicle' => $e->vehicle,
            'emergency_contact' => $e->emergency_contact,
            'notes' => $e->notes,
            'user' => $e->user ? ['id' => $e->user->id, 'email' => $e->user->email] : null,
            'has_driver_record' => $e->deliveryMan !== null,
            'face_enrolled' => $e->face_enrolled_at !== null,
        ];
    }
}
