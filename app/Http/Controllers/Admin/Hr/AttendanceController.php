<?php

namespace App\Http\Controllers\Admin\Hr;

use App\Actions\Hr\RecordAttendance;
use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AttendanceController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('view attendance');

        [$from, $to] = $this->range($request);

        $query = Attendance::with('employee:id,first_name,last_name,employee_code,position_id', 'employee.position:id,name')
            ->whereDate('work_date', '>=', $from->toDateString())
            ->whereDate('work_date', '<=', $to->toDateString());

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        $records = $query->orderByDesc('work_date')->orderByDesc('time_in')->limit(1000)->get();

        $now = CarbonImmutable::now();

        return Inertia::render('Admin/Hr/Attendance/Index', [
            'records' => $records->map(fn (Attendance $a) => [
                'id' => $a->id,
                'employee_id' => $a->employee_id,
                'employee_name' => $a->employee?->full_name,
                'employee_code' => $a->employee?->employee_code,
                'position' => $a->employee?->position?->name,
                'work_date' => $a->work_date->toDateString(),
                'time_in' => $a->time_in->format('H:i'),
                'time_out' => $a->time_out?->format('H:i'),
                'time_out_next_day' => $a->time_out && ! $a->time_out->isSameDay($a->time_in),
                'worked_minutes' => $a->worked_minutes,
                'late_minutes' => $a->late_minutes,
                'overtime_minutes' => $a->overtime_minutes,
                'source' => $a->source,
                'note' => $a->note,
            ]),
            'summary' => [
                'records' => $records->count(),
                'worked_minutes' => (int) $records->sum('worked_minutes'),
                'late_count' => $records->where('late_minutes', '>', 0)->count(),
                'late_minutes' => (int) $records->sum('late_minutes'),
                'overtime_minutes' => (int) $records->sum('overtime_minutes'),
            ],
            'clocked_in' => Attendance::with('employee:id,first_name,last_name,employee_code')
                ->whereNull('time_out')
                ->where('time_in', '>=', $now->subHours(RecordAttendance::OPEN_RECORD_MAX_HOURS))
                ->orderBy('time_in')->get()
                ->map(fn (Attendance $a) => ['id' => $a->id, 'name' => $a->employee?->full_name, 'code' => $a->employee?->employee_code, 'since' => $a->time_in->toIso8601String()]),
            'employees' => Employee::orderBy('first_name')->get(['id', 'first_name', 'last_name', 'employee_code', 'status'])
                ->map(fn (Employee $e) => ['id' => $e->id, 'name' => $e->full_name, 'code' => $e->employee_code, 'status' => $e->status]),
            'filters' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'employee_id' => $request->input('employee_id')],
            'can' => ['manage' => Auth::user()?->can('manage attendance') ?? false],
        ]);
    }

    public function store(Request $request, RecordAttendance $attendance): RedirectResponse
    {
        Gate::authorize('manage attendance');

        $record = new Attendance(['source' => 'manual', 'created_by' => $request->user()->id]);

        return $this->save($request, $record, $attendance, 'Attendance added.');
    }

    public function update(Request $request, Attendance $attendance, RecordAttendance $calculator): RedirectResponse
    {
        Gate::authorize('manage attendance');

        return $this->save($request, $attendance, $calculator, 'Attendance updated.');
    }

    public function destroy(Attendance $attendance): RedirectResponse
    {
        Gate::authorize('manage attendance');

        $attendance->delete();

        return redirect()->back()->with('success', 'Attendance record deleted.');
    }

    private function save(Request $request, Attendance $record, RecordAttendance $calculator, string $message): RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', Rule::exists('employees', 'id')],
            'work_date' => ['required', 'date', 'before_or_equal:today'],
            'time_in' => ['required', 'date_format:H:i'],
            'time_out' => ['nullable', 'date_format:H:i'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $duplicate = Attendance::where('employee_id', $validated['employee_id'])
            ->whereDate('work_date', $validated['work_date'])
            ->when($record->exists, fn ($q) => $q->whereKeyNot($record->id))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages(['work_date' => 'This employee already has an attendance record for that date. Edit that one instead.']);
        }

        $day = CarbonImmutable::parse($validated['work_date']);
        $timeIn = $day->setTimeFromTimeString($validated['time_in']);
        $timeOut = null;

        if (! empty($validated['time_out'])) {
            $timeOut = $day->setTimeFromTimeString($validated['time_out']);

            // An earlier clock-out time means the shift ended after midnight.
            if ($timeOut->lessThanOrEqualTo($timeIn)) {
                $timeOut = $timeOut->addDay();
            }
        }

        $record->fill([
            'employee_id' => $validated['employee_id'],
            'work_date' => $day->toDateString(),
            'time_in' => $timeIn,
            'time_out' => $timeOut,
            'note' => $validated['note'] ?? null,
        ]);

        $calculator->recalculate($record, Employee::find($validated['employee_id']));
        $record->save();

        return redirect()->back()->with('success', $message);
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function range(Request $request): array
    {
        try {
            $from = CarbonImmutable::parse((string) $request->query('from'))->startOfDay();
            $to = CarbonImmutable::parse((string) $request->query('to'))->endOfDay();
        } catch (\Throwable) {
            $from = CarbonImmutable::now()->startOfMonth();
            $to = CarbonImmutable::now()->endOfDay();
        }

        return $from->greaterThan($to) ? [$to->startOfDay(), $from->endOfDay()] : [$from, $to];
    }
}
