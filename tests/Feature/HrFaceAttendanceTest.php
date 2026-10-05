<?php

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Position;
use App\Models\User;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Role;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\delete;
use function Pest\Laravel\postJson;

/**
 * A fake 1024-number face embedding: a distinct "signature" per person plus a little noise.
 *
 * @return list<float>
 */
function face(int $person, float $noise = 0.0): array
{
    return array_map(fn (int $i) => (($i * 7 + $person * 13) % 10) / 10 + ($i % 2 === 0 ? $noise : -$noise), range(0, 1023));
}

beforeEach(function () {
    Carbon::setTestNow('2026-10-05 08:00:00');

    $position = Position::firstWhere('name', 'Cashier');
    $this->maria = Employee::create(['employee_code' => 'EMP-0001', 'first_name' => 'Maria', 'last_name' => 'Santos', 'position_id' => $position->id, 'base_salary' => 15000]);
    $this->jose = Employee::create(['employee_code' => 'EMP-0002', 'first_name' => 'Jose', 'last_name' => 'Cruz', 'position_id' => $position->id, 'base_salary' => 15000]);

    $this->maria->update(['face_descriptors' => [face(1), face(1, 0.01), face(1, -0.01)], 'face_enrolled_at' => now()]);
    $this->jose->update(['face_descriptors' => [face(2), face(2, 0.01), face(2, -0.01)], 'face_enrolled_at' => now()]);

    $this->admin = User::factory()->create();
    $this->admin->assignRole(Role::firstOrCreate(['name' => 'admin']));
});

afterEach(fn () => Carbon::setTestNow());

describe('Face attendance at the kiosk', function () {
    it('clocks in the employee whose face matches', function () {
        $response = postJson(route('attendance.face'), ['descriptor' => face(1, 0.005)])->assertOk();

        expect($response->json('type'))->toBe('in')->and($response->json('employee.name'))->toBe('Maria Santos');
        expect(Attendance::first())->employee_id->toBe($this->maria->id)->source->toBe('face');
    });

    it('rejects a face nobody enrolled', function () {
        postJson(route('attendance.face'), ['descriptor' => face(9)])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'not recognised'));

        expect(Attendance::count())->toBe(0);
    });

    it('ignores inactive employees', function () {
        $this->maria->update(['status' => 'inactive']);

        postJson(route('attendance.face'), ['descriptor' => face(1)])->assertStatus(422);
    });

    it('refuses an ambiguous match between two near-identical faces', function () {
        $this->jose->update(['face_descriptors' => [face(1, 0.002)]]);

        postJson(route('attendance.face'), ['descriptor' => face(1, 0.001)])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'employee ID'));
    });

    it('validates the descriptor shape', function () {
        postJson(route('attendance.face'), ['descriptor' => [0.1, 0.2]])->assertStatus(422);
        postJson(route('attendance.face'), [])->assertStatus(422);
    });

    it('never exposes stored face data publicly', function () {
        expect($this->maria->toArray())->not->toHaveKey('face_descriptors');
        $this->get(route('attendance.kiosk'))->assertOk()->assertDontSee('face_descriptors');
    });
});

describe('Enrolling a face', function () {
    it('lets an admin save samples and remove them', function () {
        $this->maria->update(['face_descriptors' => null, 'face_enrolled_at' => null]);

        actingAs($this->admin)->post(route('admin.hr.employees.face.store', $this->maria), ['descriptors' => [face(1), face(1, 0.01), face(1, 0.02)]])
            ->assertRedirect();

        expect($this->maria->fresh()->face_enrolled_at)->not->toBeNull()->and($this->maria->fresh()->face_descriptors)->toHaveCount(3);

        actingAs($this->admin)->delete(route('admin.hr.employees.face.destroy', $this->maria))->assertRedirect();

        expect($this->maria->fresh()->face_descriptors)->toBeNull();
    });

    it('needs at least three samples', function () {
        actingAs($this->admin)->post(route('admin.hr.employees.face.store', $this->maria), ['descriptors' => [face(1)]])
            ->assertSessionHasErrors('descriptors');
    });

    it('is not available to guests', function () {
        postJson(route('admin.hr.employees.face.store', $this->maria), ['descriptors' => []])->assertUnauthorized();
        delete(route('admin.hr.employees.face.destroy', $this->maria))->assertRedirect();
    });
});
