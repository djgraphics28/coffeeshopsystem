<?php

namespace App\Http\Controllers;

use App\Actions\Hr\AttendanceException;
use App\Actions\Hr\HrSettings;
use App\Actions\Hr\MatchFace;
use App\Actions\Hr\RecordAttendance;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The clock in / clock out screen. It is deliberately public (a wall tablet needs no sign-in), so it is rate
 * limited, shows only first names, can be switched off in the HR settings, and every punch notes where it came from.
 */
class AttendanceKioskController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Attendance/Kiosk', [
            'enabled' => HrSettings::flag('hr_attendance_enabled'),
            'timezone' => config('app.timezone'),
            'cafe_name' => Setting::get('cafe_name', config('app.name')),
            'face_enabled' => Employee::where('status', 'active')->whereNotNull('face_descriptors')->exists(),
            'recent' => $this->recent(),
        ]);
    }

    public function punch(Request $request, RecordAttendance $attendance): JsonResponse
    {
        if (! HrSettings::flag('hr_attendance_enabled')) {
            return response()->json(['message' => 'Attendance is switched off right now. Please see your manager.'], 403);
        }

        $validated = $request->validate(['code' => ['required', 'string', 'max:40']]);

        try {
            $result = $attendance->punch($validated['code'], $request->ip());
        } catch (AttendanceException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result + ['recent' => $this->recent()]);
    }

    /**
     * Clock in / out by face: the browser sends a 1024-number face embedding and the server finds the matching employee.
     */
    public function punchByFace(Request $request, MatchFace $match, RecordAttendance $attendance): JsonResponse
    {
        if (! HrSettings::flag('hr_attendance_enabled')) {
            return response()->json(['message' => 'Attendance is switched off right now. Please see your manager.'], 403);
        }

        $validated = $request->validate([
            'descriptor' => ['required', 'array', 'size:'.MatchFace::DESCRIPTOR_SIZE],
            'descriptor.*' => ['required', 'numeric', 'between:-100,100'],
        ]);

        try {
            $employee = $match->handle(array_map('floatval', $validated['descriptor']));
            $result = $attendance->punch($employee->employee_code, $request->ip(), source: 'face');
        } catch (AttendanceException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result + ['recent' => $this->recent()]);
    }

    /**
     * Today's latest punches, first name only.
     *
     * @return list<array{name: string, type: string, time: string}>
     */
    private function recent(): array
    {
        return Attendance::with('employee:id,first_name,last_name')
            ->where('updated_at', '>=', CarbonImmutable::now()->startOfDay())
            ->latest('updated_at')->limit(8)->get()
            ->map(fn (Attendance $a) => [
                'name' => trim(($a->employee?->first_name ?? '').' '.mb_substr((string) $a->employee?->last_name, 0, 1).'.'),
                'type' => $a->time_out ? 'out' : 'in',
                'time' => ($a->time_out ?? $a->time_in)->toIso8601String(),
            ])->all();
    }
}
