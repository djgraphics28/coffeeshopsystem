<?php

use App\Models\DeliveryMan;
use App\Models\Employee;
use App\Models\Position;
use App\Models\User;
use Spatie\Permission\Models\Role;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\delete;
use function Pest\Laravel\get;
use function Pest\Laravel\post;
use function Pest\Laravel\put;

beforeEach(function () {
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
    actingAs($this->admin);

    // The default positions are created by the migration.
    $this->driver = Position::firstWhere('name', 'Driver');
    $this->cashier = Position::firstWhere('name', 'Cashier');

    $this->payload = fn (array $overrides = []) => array_merge([
        'first_name' => 'Maria', 'last_name' => 'Santos', 'phone' => '0917 111 2222',
        'position_id' => $this->cashier->id, 'status' => 'active',
        'pay_frequency' => 'monthly', 'salary_type' => 'monthly', 'base_salary' => 15000,
    ], $overrides);
});

describe('Employees', function () {
    it('is limited to people with the employee permissions', function () {
        $cashier = User::factory()->create();
        $cashier->assignRole('cashier');

        actingAs($cashier);
        get(route('admin.hr.employees.index'))->assertForbidden();
        post(route('admin.hr.employees.store'), ($this->payload)())->assertForbidden();
    });

    it('lists employees with their positions and stats', function () {
        Employee::create(['employee_code' => 'EMP-0001', 'first_name' => 'A', 'last_name' => 'B', 'position_id' => $this->cashier->id]);

        get(route('admin.hr.employees.index'))->assertOk()->assertInertia(fn ($page) => $page
            ->component('Admin/Hr/Employees/Index')
            ->has('employees', 1)
            ->where('stats.total', 1)
            ->has('positions', Position::count()));
    });

    it('creates an employee and gives them a code from their id', function () {
        post(route('admin.hr.employees.store'), ($this->payload)())->assertSessionHasNoErrors();

        $employee = Employee::firstWhere('first_name', 'Maria');
        expect($employee->employee_code)->toBe(Employee::codeFor($employee->id))
            ->and($employee->employee_code)->toMatch('/^EMP-\d{4}$/')
            ->and($employee->base_salary)->toBe(15000.0)
            ->and($employee->pay_frequency)->toBe('monthly');
    });

    it('validates the required fields and the pay options', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['first_name' => '', 'pay_frequency' => 'weekly', 'base_salary' => -5, 'shift_start' => '8am']))
            ->assertSessionHasErrors(['first_name', 'pay_frequency', 'base_salary', 'shift_start']);
    });

    it('creates a sign-in account with the role of their position', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['create_login' => true, 'account_email' => 'maria@shop.test', 'account_password' => 'secret-pass-1']))
            ->assertSessionHasNoErrors();

        $employee = Employee::firstWhere('first_name', 'Maria');
        expect($employee->user)->not->toBeNull()
            ->and($employee->user->email)->toBe('maria@shop.test')
            ->and($employee->user->hasRole('cashier'))->toBeTrue();
    });

    it('requires an email and password when a login is requested', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['create_login' => true]))
            ->assertSessionHasErrors(['account_email', 'account_password']);

        expect(Employee::count())->toBe(0);
    });

    it('never lets an employee login be given the admin role', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['create_login' => true, 'account_email' => 'x@shop.test', 'account_password' => 'secret-pass-1', 'account_role' => 'admin']))
            ->assertSessionHasErrors('account_role');
    });

    it('takes sign-in access away from inactive employees and restores it on reactivation', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['create_login' => true, 'account_email' => 'maria@shop.test', 'account_password' => 'secret-pass-1']));
        $employee = Employee::firstWhere('first_name', 'Maria');

        put(route('admin.hr.employees.update', $employee), ($this->payload)(['status' => 'inactive']));
        expect($employee->fresh()->user->roles)->toHaveCount(0);

        put(route('admin.hr.employees.update', $employee), ($this->payload)(['status' => 'active']));
        expect($employee->fresh()->user->hasRole('cashier'))->toBeTrue();
    });

    it('cannot delete an employee who has history, but can deactivate them', function () {
        post(route('admin.hr.employees.store'), ($this->payload)());
        $employee = Employee::firstWhere('first_name', 'Maria');
        $employee->attendances()->create(['work_date' => today(), 'time_in' => now()]);

        delete(route('admin.hr.employees.destroy', $employee))->assertSessionHas('error');
        expect(Employee::count())->toBe(1);

        $employee->attendances()->delete();
        delete(route('admin.hr.employees.destroy', $employee))->assertSessionHas('success');
        expect(Employee::count())->toBe(0);
    });

    it('deletes the sign-in account along with an employee that has no history', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['create_login' => true, 'account_email' => 'maria@shop.test', 'account_password' => 'secret-pass-1']));
        $employee = Employee::firstWhere('first_name', 'Maria');

        delete(route('admin.hr.employees.destroy', $employee));

        expect(User::where('email', 'maria@shop.test')->exists())->toBeFalse();
    });
});

describe('Drivers', function () {
    it('creates the delivery man record when a driver employee is added', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['first_name' => 'Juan', 'last_name' => 'Cruz', 'phone' => '0999', 'position_id' => $this->driver->id, 'vehicle' => 'Honda Click']))
            ->assertSessionHasNoErrors();

        $employee = Employee::firstWhere('first_name', 'Juan');
        $deliveryMan = DeliveryMan::firstWhere('employee_id', $employee->id);

        expect($deliveryMan)->not->toBeNull()
            ->and($deliveryMan->name)->toBe('Juan Cruz')
            ->and($deliveryMan->phone)->toBe('0999')
            ->and($deliveryMan->vehicle)->toBe('Honda Click')
            ->and($deliveryMan->is_active)->toBeTrue();
    });

    it('keeps the delivery man in step when the employee changes', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['first_name' => 'Juan', 'last_name' => 'Cruz', 'position_id' => $this->driver->id, 'vehicle' => 'Bike']));
        $employee = Employee::firstWhere('first_name', 'Juan');

        put(route('admin.hr.employees.update', $employee), ($this->payload)(['first_name' => 'Juanito', 'last_name' => 'Cruz', 'position_id' => $this->driver->id, 'vehicle' => 'Motorcycle', 'phone' => '0888']));

        $deliveryMan = DeliveryMan::firstWhere('employee_id', $employee->id);
        expect(DeliveryMan::count())->toBe(1)
            ->and($deliveryMan->name)->toBe('Juanito Cruz')
            ->and($deliveryMan->vehicle)->toBe('Motorcycle')
            ->and($deliveryMan->phone)->toBe('0888');
    });

    it('switches the delivery man off when they stop being an active driver, without deleting them', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['position_id' => $this->driver->id]));
        $employee = Employee::firstWhere('first_name', 'Maria');
        $deliveryManId = DeliveryMan::firstWhere('employee_id', $employee->id)->id;

        put(route('admin.hr.employees.update', $employee), ($this->payload)(['position_id' => $this->cashier->id]));
        expect(DeliveryMan::find($deliveryManId)->is_active)->toBeFalse();

        put(route('admin.hr.employees.update', $employee), ($this->payload)(['position_id' => $this->driver->id]));
        expect(DeliveryMan::find($deliveryManId)->is_active)->toBeTrue();

        put(route('admin.hr.employees.update', $employee), ($this->payload)(['position_id' => $this->driver->id, 'status' => 'inactive']));
        expect(DeliveryMan::find($deliveryManId)->is_active)->toBeFalse()->and(DeliveryMan::count())->toBe(1);
    });

    it('uses the employee login as the driver-app login', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['position_id' => $this->driver->id, 'create_login' => true, 'account_email' => 'driver@shop.test', 'account_password' => 'secret-pass-1']));

        $employee = Employee::firstWhere('first_name', 'Maria');
        $deliveryMan = DeliveryMan::firstWhere('employee_id', $employee->id);

        expect($deliveryMan->user_id)->toBe($employee->user_id)
            ->and($employee->user->hasRole('driver'))->toBeTrue();
    });

    it('does not store a vehicle for non-drivers', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['vehicle' => 'Should be dropped']));

        expect(Employee::firstWhere('first_name', 'Maria')->vehicle)->toBeNull();
    });

    it('re-syncs everyone when a position is switched to or from driver', function () {
        post(route('admin.hr.employees.store'), ($this->payload)(['position_id' => $this->cashier->id]));
        $employee = Employee::firstWhere('first_name', 'Maria');
        expect(DeliveryMan::count())->toBe(0);

        put(route('admin.hr.positions.update', $this->cashier), ['name' => 'Cashier', 'is_driver' => true, 'is_active' => true]);
        expect(DeliveryMan::firstWhere('employee_id', $employee->id)?->is_active)->toBeTrue();
    });
});

describe('Positions', function () {
    it('cannot delete a position that employees hold', function () {
        post(route('admin.hr.employees.store'), ($this->payload)());

        delete(route('admin.hr.positions.destroy', $this->cashier))->assertSessionHas('error');
        expect(Position::whereKey($this->cashier->id)->exists())->toBeTrue();
    });

    it('adds the default positions without duplicating existing ones', function () {
        Position::query()->delete();
        post(route('admin.hr.positions.defaults'));
        $count = Position::count();

        post(route('admin.hr.positions.defaults'));

        expect(Position::count())->toBe($count)
            ->and(Position::where('name', 'Driver')->count())->toBe(1)
            ->and(Position::firstWhere('name', 'Driver')->is_driver)->toBeTrue()
            ->and(Role::where('name', Position::firstWhere('name', 'Barista')->system_role)->exists())->toBeTrue();
    });
});
