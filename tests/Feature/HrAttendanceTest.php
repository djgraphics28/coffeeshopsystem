<?php

use App\Actions\Hr\AttendanceException;
use App\Actions\Hr\RecordAttendance;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Position;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\delete;
use function Pest\Laravel\get;
use function Pest\Laravel\post;
use function Pest\Laravel\postJson;
use function Pest\Laravel\put;

/**
 * Mon 5 Oct 2026. Default shift is 08:00–17:00 with a 10 minute grace and a 60 minute unpaid break.
 */
beforeEach(function () {
    Carbon::setTestNow('2026-10-05 07:50:00');

    $this->employee = Employee::create([
        'employee_code' => 'EMP-0001', 'first_name' => 'Maria', 'last_name' => 'Santos',
        'position_id' => Position::firstWhere('name', 'Cashier')->id, 'base_salary' => 15000,
    ]);

    $this->at = function (string $time, ?string $code = 'EMP-0001') {
        Carbon::setTestNow("2026-10-05 {$time}:00");

        return app(RecordAttendance::class)->punch($code);
    };
});

afterEach(fn () => Carbon::setTestNow());

describe('Clocking in and out', function () {
    it('clocks in, then out, and works out the hours', function () {
        $in = ($this->at)('07:55');
        expect($in['type'])->toBe('in')->and($in['late_minutes'])->toBe(0)->and($in['employee']['name'])->toBe('Maria Santos');

        $out = ($this->at)('17:30');
        expect($out['type'])->toBe('out')->and($out['message'])->toContain('Clocked out');

        $record = Attendance::first();
        // 07:55 → 17:30 is 9h35m; the 60 minute unpaid break comes off.
        expect($record->worked_minutes)->toBe(515)
            ->and($record->overtime_minutes)->toBe(30)
            ->and($record->work_date->toDateString())->toBe('2026-10-05')
            ->and($record->source)->toBe('kiosk');
    });

    it('accepts the code in any capitalisation, with spaces, or just the number', function () {
        foreach (['emp-0001', '  EMP-0001  ', '1', '0001'] as $i => $code) {
            Attendance::query()->delete();
            Carbon::setTestNow('2026-10-05 08:00:00');

            expect(app(RecordAttendance::class)->punch($code)['type'])->toBe('in');
        }
    });

    it('forgives lateness inside the grace period and counts all of it beyond', function () {
        expect(($this->at)('08:10')['late_minutes'])->toBe(0);

        Attendance::query()->delete();
        expect(($this->at)('08:11')['late_minutes'])->toBe(11);

        Attendance::query()->delete();
        expect(($this->at)('09:30')['late_minutes'])->toBe(90);
    });

    it('does not take a break off a short day', function () {
        ($this->at)('08:00');
        ($this->at)('12:00');

        expect(Attendance::first()->worked_minutes)->toBe(240);
    });

    it('treats a second scan within a minute as an accidental double scan', function () {
        ($this->at)('08:00');

        expect(fn () => ($this->at)('08:00'))->toThrow(AttendanceException::class, 'already clocked in');
        expect(Attendance::count())->toBe(1)->and(Attendance::first()->time_out)->toBeNull();
    });

    it('does not allow a second shift on the same day', function () {
        ($this->at)('08:00');
        ($this->at)('12:00');

        expect(fn () => ($this->at)('13:00'))->toThrow(AttendanceException::class, 'already done for today');
        expect(Attendance::count())->toBe(1);
    });

    it('rejects unknown codes and inactive employees with a clear message', function () {
        expect(fn () => ($this->at)('08:00', 'EMP-9999'))->toThrow(AttendanceException::class, 'not found');
        expect(fn () => ($this->at)('08:00', ''))->toThrow(AttendanceException::class);

        $this->employee->update(['status' => 'inactive']);
        expect(fn () => ($this->at)('08:00'))->toThrow(AttendanceException::class, 'not active');
        expect(Attendance::count())->toBe(0);
    });

    it('closes a night shift that crossed midnight instead of starting a new day', function () {
        $this->employee->update(['shift_start' => '22:00', 'shift_end' => '06:00']);

        Carbon::setTestNow('2026-10-05 21:55:00');
        app(RecordAttendance::class)->punch('EMP-0001');

        Carbon::setTestNow('2026-10-06 06:30:00');
        $out = app(RecordAttendance::class)->punch('EMP-0001');

        $record = Attendance::first();
        expect($out['type'])->toBe('out')->and(Attendance::count())->toBe(1)
            ->and($record->work_date->toDateString())->toBe('2026-10-05')
            ->and($record->overtime_minutes)->toBe(30)
            ->and($record->worked_minutes)->toBe(455);
    });

    it('starts a fresh record when a forgotten clock-out is more than 20 hours old', function () {
        ($this->at)('08:00');

        Carbon::setTestNow('2026-10-06 08:00:00');
        $result = app(RecordAttendance::class)->punch('EMP-0001');

        expect($result['type'])->toBe('in')->and(Attendance::count())->toBe(2)
            ->and(Attendance::whereNull('time_out')->count())->toBe(2);
    });

    it('ignores overtime when it is switched off', function () {
        Setting::set('hr_overtime_enabled', '0');

        ($this->at)('08:00');
        ($this->at)('18:00');

        expect(Attendance::first()->overtime_minutes)->toBe(0);
    });

    it('uses the employee shift instead of the company default', function () {
        $this->employee->update(['shift_start' => '10:00', 'shift_end' => '19:00']);

        ($this->at)('10:30');

        expect(Attendance::first()->late_minutes)->toBe(30);
    });
});

describe('Attendance screen (public)', function () {
    it('opens without signing in', function () {
        get(route('attendance.kiosk'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('Attendance/Kiosk')->where('enabled', true)->has('recent'));
    });

    it('clocks an employee in and out over HTTP, noting where it came from', function () {
        postJson(route('attendance.punch'), ['code' => 'EMP-0001'], ['REMOTE_ADDR' => '10.1.2.3'])
            ->assertOk()->assertJsonPath('type', 'in')->assertJsonPath('employee.name', 'Maria Santos')->assertJsonPath('recent.0.name', 'Maria S.');

        expect(Attendance::first()->ip_address)->not->toBeNull();

        Carbon::setTestNow('2026-10-05 12:00:00');
        postJson(route('attendance.punch'), ['code' => 'EMP-0001'])->assertOk()->assertJsonPath('type', 'out');
    });

    it('answers a wrong code with a friendly 422 and creates nothing', function () {
        postJson(route('attendance.punch'), ['code' => 'NOPE'])
            ->assertStatus(422)->assertJsonPath('message', fn (string $m) => str_contains($m, 'not found'));

        postJson(route('attendance.punch'), [])->assertStatus(422)->assertJsonValidationErrors('code');
        expect(Attendance::count())->toBe(0);
    });

    it('can be switched off in the HR settings', function () {
        Setting::set('hr_attendance_enabled', '0');

        postJson(route('attendance.punch'), ['code' => 'EMP-0001'])->assertForbidden();
        get(route('attendance.kiosk'))->assertInertia(fn ($page) => $page->where('enabled', false));
        expect(Attendance::count())->toBe(0);
    });

    it('is rate limited so employee IDs cannot be guessed quickly', function () {
        foreach (range(1, 20) as $i) {
            postJson(route('attendance.punch'), ['code' => "GUESS-{$i}"])->assertStatus(422);
        }

        postJson(route('attendance.punch'), ['code' => 'GUESS-21'])->assertStatus(429);
    });

    it('shows only first names and a last initial', function () {
        ($this->at)('08:00');

        $recent = get(route('attendance.kiosk'))->inertiaProps('recent');
        expect($recent[0]['name'])->toBe('Maria S.')->and(array_keys($recent[0]))->toBe(['name', 'type', 'time']);
    });
});

describe('Attendance records (admin)', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        actingAs($this->admin);
    });

    it('lists records for the chosen dates with a summary and who is clocked in now', function () {
        ($this->at)('08:30');
        ($this->at)('17:00');
        Carbon::setTestNow('2026-10-06 08:00:00');
        app(RecordAttendance::class)->punch('EMP-0001');

        get(route('admin.hr.attendance.index', ['from' => '2026-10-01', 'to' => '2026-10-31']))
            ->assertOk()->assertInertia(fn ($page) => $page
            ->component('Admin/Hr/Attendance/Index')
            ->has('records', 2)
            ->where('summary.late_count', 1)
            ->where('summary.worked_minutes', 450)
            ->has('clocked_in', 1));

        get(route('admin.hr.attendance.index', ['from' => '2026-10-06', 'to' => '2026-10-06']))
            ->assertInertia(fn ($page) => $page->has('records', 1));
    });

    it('lets a manager add a record by hand, recalculating late and worked time', function () {
        post(route('admin.hr.attendance.store'), [
            'employee_id' => $this->employee->id, 'work_date' => '2026-10-02', 'time_in' => '09:00', 'time_out' => '18:00', 'note' => 'Forgot to clock in',
        ])->assertSessionHasNoErrors();

        $record = Attendance::first();
        expect($record->source)->toBe('manual')->and($record->late_minutes)->toBe(60)
            ->and($record->worked_minutes)->toBe(480)->and($record->overtime_minutes)->toBe(60)->and($record->created_by)->toBe($this->admin->id);
    });

    it('treats an earlier clock-out time as the next morning', function () {
        post(route('admin.hr.attendance.store'), [
            'employee_id' => $this->employee->id, 'work_date' => '2026-10-02', 'time_in' => '22:00', 'time_out' => '06:00',
        ]);

        expect(Attendance::first()->time_out->toDateTimeString())->toBe('2026-10-03 06:00:00');
    });

    it('refuses a second record for the same employee and day, and future dates', function () {
        post(route('admin.hr.attendance.store'), ['employee_id' => $this->employee->id, 'work_date' => '2026-10-02', 'time_in' => '08:00']);

        post(route('admin.hr.attendance.store'), ['employee_id' => $this->employee->id, 'work_date' => '2026-10-02', 'time_in' => '09:00'])
            ->assertSessionHasErrors('work_date');
        post(route('admin.hr.attendance.store'), ['employee_id' => $this->employee->id, 'work_date' => '2026-12-31', 'time_in' => '09:00'])
            ->assertSessionHasErrors('work_date');

        expect(Attendance::count())->toBe(1);
    });

    it('edits and deletes records', function () {
        $record = Attendance::create(['employee_id' => $this->employee->id, 'work_date' => '2026-10-02', 'time_in' => '2026-10-02 08:00:00', 'source' => 'manual']);

        put(route('admin.hr.attendance.update', $record), ['employee_id' => $this->employee->id, 'work_date' => '2026-10-02', 'time_in' => '08:00', 'time_out' => '12:00'])
            ->assertSessionHasNoErrors();
        expect($record->fresh()->worked_minutes)->toBe(240);

        delete(route('admin.hr.attendance.destroy', $record));
        expect(Attendance::count())->toBe(0);
    });

    it('is limited to people with the attendance permissions', function () {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');
        actingAs($cashier);

        get(route('admin.hr.attendance.index'))->assertForbidden();
        post(route('admin.hr.attendance.store'), [])->assertForbidden();
    });
});
