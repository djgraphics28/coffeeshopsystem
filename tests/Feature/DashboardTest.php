<?php

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

use function Pest\Laravel\actingAs;

/**
 * Wednesday 14 Oct 2026: that week runs Mon 12 – Sun 18, that month 1 – 31 Oct.
 */
beforeEach(function () {
    Carbon::setTestNow('2026-10-14 12:00:00');

    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
    $this->category = ExpenseCategory::create(['name' => 'Supplies', 'color' => '#3B82F6', 'is_active' => true]);

    $this->sale = fn (string $when, float $total, string $status = 'completed') => Order::factory()->create(['status' => $status, 'total' => $total, 'created_at' => $when]);
    $this->spend = fn (string $date, float $amount, string $title = 'Beans') => Expense::create(['expense_category_id' => $this->category->id, 'title' => $title, 'amount' => $amount, 'expense_date' => $date]);
    $this->dashboard = fn (array $query = []) => actingAs($this->admin)->get(route('admin.dashboard', $query));
});

afterEach(fn () => Carbon::setTestNow());

describe('Dashboard period filter', function () {
    it('defaults to today', function () {
        ($this->sale)('2026-10-14 09:00:00', 200);
        ($this->sale)('2026-10-13 09:00:00', 999);
        ($this->spend)('2026-10-14', 50);
        ($this->spend)('2026-10-13', 777);

        ($this->dashboard)()->assertInertia(fn ($page) => $page
            ->component('Admin/Dashboard')
            ->where('filters.period', 'today')
            ->where('stats.revenue', 200)
            ->where('stats.expenses', 50)
            ->where('stats.net', 150)
            ->where('range.granularity', 'hour')
            ->has('series', 24));
    });

    it('covers Monday to Sunday for this week', function () {
        ($this->sale)('2026-10-11 23:00:00', 1000); // previous Sunday
        ($this->sale)('2026-10-12 08:00:00', 100);
        ($this->sale)('2026-10-18 20:00:00', 300);
        ($this->spend)('2026-10-15', 40);

        ($this->dashboard)(['period' => 'week'])->assertInertia(fn ($page) => $page
            ->where('filters.from', '2026-10-12')
            ->where('filters.to', '2026-10-18')
            ->where('stats.revenue', 400)
            ->where('stats.expenses', 40)
            ->where('range.granularity', 'day')
            ->has('series', 7));
    });

    it('covers the whole calendar month for this month', function () {
        ($this->sale)('2026-09-30 23:59:00', 500);
        ($this->sale)('2026-10-01 00:00:00', 100);
        ($this->sale)('2026-10-31 23:00:00', 50);
        ($this->spend)('2026-10-20', 25);

        ($this->dashboard)(['period' => 'month'])->assertInertia(fn ($page) => $page
            ->where('filters.from', '2026-10-01')
            ->where('filters.to', '2026-10-31')
            ->where('stats.revenue', 150)
            ->where('stats.expenses', 25)
            ->has('series', 31));
    });

    it('supports a custom date range, including both end dates', function () {
        ($this->sale)('2026-10-02 00:30:00', 10);
        ($this->sale)('2026-10-05 23:30:00', 20);
        ($this->sale)('2026-10-06 00:30:00', 999);
        ($this->spend)('2026-10-02', 3);
        ($this->spend)('2026-10-05', 4);
        ($this->spend)('2026-10-06', 999);

        ($this->dashboard)(['period' => 'custom', 'from' => '2026-10-02', 'to' => '2026-10-05'])->assertInertia(fn ($page) => $page
            ->where('filters.period', 'custom')
            ->where('stats.revenue', 30)
            ->where('stats.expenses', 7)
            ->has('series', 4));
    });

    it('treats a single-day custom range as hourly and swaps a reversed range', function () {
        ($this->dashboard)(['period' => 'custom', 'from' => '2026-10-03', 'to' => '2026-10-03'])
            ->assertInertia(fn ($page) => $page->where('range.granularity', 'hour'));

        ($this->dashboard)(['period' => 'custom', 'from' => '2026-10-10', 'to' => '2026-10-05'])
            ->assertInertia(fn ($page) => $page->where('filters.from', '2026-10-05')->where('filters.to', '2026-10-10'));
    });

    it('falls back to today for a broken custom range and caps very long ones', function () {
        ($this->dashboard)(['period' => 'custom', 'from' => 'nonsense', 'to' => ''])
            ->assertInertia(fn ($page) => $page->where('filters.period', 'today'));

        ($this->dashboard)(['period' => 'bogus'])->assertInertia(fn ($page) => $page->where('filters.period', 'today'));

        ($this->dashboard)(['period' => 'custom', 'from' => '2015-01-01', 'to' => '2026-10-14'])
            ->assertInertia(fn ($page) => $page->where('filters.to', '2016-01-01')->where('range.granularity', 'month'));
    });
});

describe('Dashboard figures', function () {
    it('only counts completed orders as revenue but counts every order', function () {
        ($this->sale)('2026-10-14 08:00:00', 100);
        ($this->sale)('2026-10-14 09:00:00', 300);
        ($this->sale)('2026-10-14 10:00:00', 500, 'pending');
        ($this->sale)('2026-10-14 11:00:00', 700, 'voided');

        ($this->dashboard)()->assertInertia(fn ($page) => $page
            ->where('stats.revenue', 400)
            ->where('stats.order_count', 4)
            ->where('stats.avg_order_value', 200)
            ->where('orders_by_status.completed', 2)
            ->where('orders_by_status.pending', 1));
    });

    it('compares with the equally long previous period', function () {
        ($this->sale)('2026-10-13 10:00:00', 100); // yesterday
        ($this->sale)('2026-10-14 10:00:00', 150); // today
        ($this->spend)('2026-10-13', 200);
        ($this->spend)('2026-10-14', 100);

        ($this->dashboard)()->assertInertia(fn ($page) => $page
            ->where('stats.trends.revenue', 50)
            ->where('stats.trends.expenses', -50)
            ->where('stats.trends.net', fn ($v) => $v > 0));
    });

    it('has no trend when there is nothing to compare with', function () {
        ($this->sale)('2026-10-14 10:00:00', 150);

        ($this->dashboard)()->assertInertia(fn ($page) => $page->where('stats.trends.revenue', null)->where('stats.trends.expenses', null));
    });

    it('breaks expenses down by category and lists the most recent ones', function () {
        $utilities = ExpenseCategory::create(['name' => 'Utilities', 'color' => '#F59E0B', 'is_active' => true]);
        ($this->spend)('2026-10-14', 60, 'Coffee beans');
        Expense::create(['expense_category_id' => $utilities->id, 'title' => 'Electricity', 'amount' => 140, 'expense_date' => '2026-10-14']);

        ($this->dashboard)()->assertInertia(fn ($page) => $page
            ->where('expense_summary.total', 200)
            ->where('expense_summary.count', 2)
            ->where('expense_summary.average', 100)
            ->where('expense_summary.by_category.0.name', 'Utilities')
            ->where('expense_summary.by_category.0.amount', 140)
            ->has('expense_summary.recent', 2));
    });

    it('hides expense figures from users without the view expenses permission', function () {
        ($this->spend)('2026-10-14', 60);
        Role::findByName('admin')->revokePermissionTo('view expenses');
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        ($this->dashboard)()->assertInertia(fn ($page) => $page
            ->where('can.view_expenses', false)
            ->where('stats.expenses', 0)
            ->where('expense_summary', null));
    });
});
