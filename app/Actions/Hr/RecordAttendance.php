<?php

namespace App\Actions\Hr;

use App\Models\Attendance;
use App\Models\Employee;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Clock in / clock out from a scanned or typed employee code, and the arithmetic (hours, late, overtime) behind it.
 */
class RecordAttendance
{
    /** Scanning twice within this many seconds is treated as an accidental double scan. */
    public const DOUBLE_SCAN_SECONDS = 60;

    /** An unfinished record older than this is considered forgotten rather than a night shift still running. */
    public const OPEN_RECORD_MAX_HOURS = 20;

    /** Breaks are only deducted from days longer than this. */
    private const BREAK_AFTER_MINUTES = 300;

    /**
     * @return array{type: 'in'|'out', employee: array<string, mixed>, time: string, worked_minutes: int|null, late_minutes: int, message: string}
     *
     * @throws AttendanceException
     */
    public function punch(string $code, ?string $ip = null, ?CarbonImmutable $now = null, string $source = 'kiosk'): array
    {
        $now ??= CarbonImmutable::now();
        $employee = Employee::findByCode($code);

        if (! $employee) {
            throw new AttendanceException('Employee ID not found. Please check the code and try again.');
        }

        if (! $employee->isActive()) {
            throw new AttendanceException("{$employee->first_name}, your employee record is not active. Please see your manager.");
        }

        return DB::transaction(function () use ($employee, $ip, $now, $source) {
            // Serialise punches for this employee so a double tap cannot create two records.
            Employee::whereKey($employee->id)->lockForUpdate()->first();

            $open = Attendance::where('employee_id', $employee->id)
                ->whereNull('time_out')
                ->where('time_in', '>=', $now->subHours(self::OPEN_RECORD_MAX_HOURS))
                ->latest('time_in')
                ->first();

            if ($open) {
                if ($open->time_in->diffInSeconds($now, true) < self::DOUBLE_SCAN_SECONDS) {
                    throw new AttendanceException("You already clocked in at {$open->time_in->format('g:i A')}. Wait a minute before clocking out.");
                }

                $open->time_out = $now;
                $this->recalculate($open, $employee);
                $open->save();

                return $this->result('out', $employee, $open, $now);
            }

            $today = Attendance::where('employee_id', $employee->id)->whereDate('work_date', $now->toDateString())->first();

            if ($today) {
                throw new AttendanceException(sprintf(
                    'You are already done for today (in %s, out %s). See your manager if this is wrong.',
                    $today->time_in->format('g:i A'),
                    $today->time_out?->format('g:i A') ?? '—',
                ));
            }

            $record = new Attendance([
                'employee_id' => $employee->id,
                'work_date' => $now->toDateString(),
                'time_in' => $now,
                'source' => $source,
                'ip_address' => $ip,
            ]);
            $this->recalculate($record, $employee);
            $record->save();

            return $this->result('in', $employee, $record, $now);
        });
    }

    /**
     * Fills in worked, late and overtime minutes from the times on the record and the employee's shift.
     */
    public function recalculate(Attendance $attendance, ?Employee $employee = null): void
    {
        $employee ??= $attendance->employee;

        [$shiftStart, $shiftEnd] = self::shift($employee, CarbonImmutable::parse($attendance->work_date));
        $timeIn = CarbonImmutable::parse($attendance->time_in);

        $lateness = $shiftStart->diffInMinutes($timeIn, false);
        $attendance->late_minutes = $lateness > (int) HrSettings::number('hr_late_grace_minutes') ? (int) $lateness : 0;

        if (! $attendance->time_out) {
            $attendance->worked_minutes = 0;
            $attendance->overtime_minutes = 0;

            return;
        }

        $timeOut = CarbonImmutable::parse($attendance->time_out);
        $minutes = max(0, (int) $timeIn->diffInMinutes($timeOut, false));

        if ($minutes > self::BREAK_AFTER_MINUTES) {
            $minutes = max(0, $minutes - (int) HrSettings::number('hr_unpaid_break_minutes'));
        }

        $attendance->worked_minutes = $minutes;
        $overtime = $shiftEnd->diffInMinutes($timeOut, false);
        $attendance->overtime_minutes = HrSettings::flag('hr_overtime_enabled') && $overtime > 0 ? (int) $overtime : 0;
    }

    /**
     * The scheduled start and end of the employee's shift on a date (their own times, else the company default).
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function shift(Employee $employee, CarbonImmutable $date): array
    {
        $start = $date->startOfDay()->setTimeFromTimeString($employee->shift_start ?: HrSettings::get('hr_default_shift_start'));
        $end = $date->startOfDay()->setTimeFromTimeString($employee->shift_end ?: HrSettings::get('hr_default_shift_end'));

        // A shift that ends "before" it starts runs past midnight.
        if ($end->lessThanOrEqualTo($start)) {
            $end = $end->addDay();
        }

        return [$start, $end];
    }

    /**
     * @return array{type: 'in'|'out', employee: array<string, mixed>, time: string, worked_minutes: int|null, late_minutes: int, message: string}
     */
    private function result(string $type, Employee $employee, Attendance $record, CarbonImmutable $now): array
    {
        $employee->loadMissing('position');
        $first = $employee->first_name;
        $time = $now->format('g:i A');

        $message = $type === 'in'
            ? ($record->late_minutes > 0 ? "Good day, {$first}! Clocked in at {$time} ({$record->late_minutes} min late)." : "Good day, {$first}! Clocked in at {$time}.")
            : sprintf('Thank you, %s! Clocked out at %s. Worked %s.', $first, $time, self::duration($record->worked_minutes));

        return [
            'type' => $type,
            'employee' => [
                'name' => $employee->full_name,
                'code' => $employee->employee_code,
                'position' => $employee->position?->name,
            ],
            'time' => $now->toIso8601String(),
            'worked_minutes' => $type === 'out' ? $record->worked_minutes : null,
            'late_minutes' => $record->late_minutes,
            'message' => $message,
        ];
    }

    public static function duration(int $minutes): string
    {
        return intdiv($minutes, 60).'h '.str_pad((string) ($minutes % 60), 2, '0', STR_PAD_LEFT).'m';
    }
}
