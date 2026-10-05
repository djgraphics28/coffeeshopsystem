<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    private const PERIODS = ['today', 'week', 'month', 'custom'];

    /** A custom range is capped so a typo cannot ask for decades of data. */
    private const MAX_RANGE_DAYS = 366;

    public function index(Request $request): Response
    {
        [$period, $start, $end] = $this->resolvePeriod($request);

        $days = (int) $start->startOfDay()->diffInDays($end->startOfDay()) + 1;
        $previousStart = $start->subDays($days);
        $previousEnd = $start->subSecond();

        $canViewExpenses = Auth::user()?->can('view expenses') ?? false;

        $current = $this->totals($start, $end, $canViewExpenses);
        $previous = $this->totals($previousStart, $previousEnd, $canViewExpenses);

        $orders = fn () => Order::query()->whereBetween('created_at', [$start, $end]);

        $recentOrders = $orders()
            ->with(['table', 'items'])
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status,
                'type' => $o->type,
                'total' => $o->total,
                'table_name' => $o->table?->name ?? 'Walk-in',
                'items_count' => $o->items->count(),
                'created_at' => $o->created_at,
            ]);

        $topItems = OrderItem::select('menu_item_id', DB::raw('SUM(quantity) as total_sold'), DB::raw('SUM(subtotal) as revenue'))
            ->whereHas('order', fn ($q) => $q->whereBetween('created_at', [$start, $end])->where('status', 'completed'))
            ->with('menuItem:id,name')
            ->groupBy('menu_item_id')
            ->orderByDesc('total_sold')
            ->limit(5)
            ->get()
            ->map(fn ($i) => [
                'name' => $i->menuItem?->name,
                'total_sold' => (int) $i->total_sold,
                'revenue' => (float) $i->revenue,
            ]);

        $granularity = $days === 1 ? 'hour' : ($days <= 62 ? 'day' : 'month');

        return Inertia::render('Admin/Dashboard', [
            'filters' => [
                'period' => $period,
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
            ],
            'range' => [
                'label' => $this->rangeLabel($period, $start, $end),
                'days' => $days,
                'granularity' => $granularity,
            ],
            'currency' => Setting::get('currency', '₱'),
            'can' => ['view_expenses' => $canViewExpenses],
            'stats' => [
                'revenue' => $current['revenue'],
                'order_count' => $current['orders'],
                'avg_order_value' => $current['avg'],
                'expenses' => $current['expenses'],
                'net' => $current['net'],
                'trends' => [
                    'revenue' => $this->trend($current['revenue'], $previous['revenue']),
                    'order_count' => $this->trend($current['orders'], $previous['orders']),
                    'avg_order_value' => $this->trend($current['avg'], $previous['avg']),
                    'expenses' => $this->trend($current['expenses'], $previous['expenses']),
                    'net' => $this->trend($current['net'], $previous['net']),
                ],
            ],
            'series' => $this->series($start, $end, $granularity, $canViewExpenses),
            'orders_by_status' => $orders()->select('status', DB::raw('count(*) as count'))->groupBy('status')->pluck('count', 'status'),
            'recent_orders' => $recentOrders,
            'top_items' => $topItems,
            'expense_summary' => $canViewExpenses ? $this->expenseSummary($start, $end, $current['expenses']) : null,
        ]);
    }

    /**
     * @return array{0: string, 1: CarbonImmutable, 2: CarbonImmutable}
     */
    private function resolvePeriod(Request $request): array
    {
        $period = in_array($request->query('period'), self::PERIODS, true) ? $request->query('period') : 'today';
        $now = CarbonImmutable::now();

        if ($period === 'custom') {
            try {
                $from = CarbonImmutable::parse((string) $request->query('from'))->startOfDay();
                $to = CarbonImmutable::parse((string) $request->query('to'))->endOfDay();
            } catch (\Throwable) {
                return ['today', $now->startOfDay(), $now->endOfDay()];
            }

            if ($from->greaterThan($to)) {
                [$from, $to] = [$to->startOfDay(), $from->endOfDay()];
            }

            if ($from->diffInDays($to) >= self::MAX_RANGE_DAYS) {
                $to = $from->addDays(self::MAX_RANGE_DAYS - 1)->endOfDay();
            }

            return ['custom', $from, $to];
        }

        return match ($period) {
            'week' => ['week', $now->startOfWeek(), $now->endOfWeek()],
            'month' => ['month', $now->startOfMonth(), $now->endOfMonth()],
            default => ['today', $now->startOfDay(), $now->endOfDay()],
        };
    }

    /**
     * @return array{revenue: float, orders: int, avg: float, expenses: float, net: float}
     */
    private function totals(CarbonImmutable $start, CarbonImmutable $end, bool $withExpenses): array
    {
        $completed = Order::query()->whereBetween('created_at', [$start, $end])->where('status', 'completed');

        $revenue = (float) (clone $completed)->sum('total');
        $completedCount = (clone $completed)->count();
        $orders = Order::query()->whereBetween('created_at', [$start, $end])->count();
        $expenses = $withExpenses ? $this->expensesBetween($start, $end)->sum('amount') : 0.0;

        return [
            'revenue' => round($revenue, 2),
            'orders' => $orders,
            'avg' => $completedCount > 0 ? round($revenue / $completedCount, 2) : 0.0,
            'expenses' => round((float) $expenses, 2),
            'net' => round($revenue - (float) $expenses, 2),
        ];
    }

    private function expensesBetween(CarbonImmutable $start, CarbonImmutable $end): Builder
    {
        return Expense::query()
            ->whereDate('expense_date', '>=', $start->toDateString())
            ->whereDate('expense_date', '<=', $end->toDateString());
    }

    /** Percent change against the previous period, or null when there is nothing to compare with. */
    private function trend(float|int $current, float|int $previous): ?float
    {
        if ((float) $previous === 0.0) {
            return null;
        }

        return round((($current - $previous) / abs($previous)) * 100, 1);
    }

    /**
     * Revenue (completed orders) and expenses grouped into hours, days or months for the chart.
     *
     * @return list<array{label: string, revenue: float, expenses: float}>
     */
    private function series(CarbonImmutable $start, CarbonImmutable $end, string $granularity, bool $withExpenses): array
    {
        $key = fn (CarbonImmutable $date): string => match ($granularity) {
            'hour' => $date->format('H'),
            'day' => $date->format('Y-m-d'),
            default => $date->format('Y-m'),
        };

        $revenue = Order::query()->whereBetween('created_at', [$start, $end])->where('status', 'completed')
            ->get(['created_at', 'total'])
            ->groupBy(fn (Order $o) => $key(CarbonImmutable::instance($o->created_at)))
            ->map(fn (Collection $rows) => (float) $rows->sum('total'));

        // Expenses are recorded per day, so a single-day (hourly) chart shows revenue only.
        $expenses = ($withExpenses && $granularity !== 'hour')
            ? $this->expensesBetween($start, $end)->get(['expense_date', 'amount'])
                ->groupBy(fn (Expense $e) => $key(CarbonImmutable::instance($e->expense_date)))
                ->map(fn (Collection $rows) => (float) $rows->sum('amount'))
            : collect();

        $points = [];

        if ($granularity === 'hour') {
            for ($h = 0; $h < 24; $h++) {
                $k = str_pad((string) $h, 2, '0', STR_PAD_LEFT);
                $points[] = ['label' => $start->setTime($h, 0)->format('g A'), 'revenue' => round($revenue[$k] ?? 0, 2), 'expenses' => 0.0];
            }

            return $points;
        }

        $cursor = $granularity === 'day' ? $start->startOfDay() : $start->startOfMonth();
        $last = $end->endOfDay();

        while ($cursor->lessThanOrEqualTo($last)) {
            $k = $key($cursor);
            $points[] = [
                'label' => $granularity === 'day' ? $cursor->format('M j') : $cursor->format('M Y'),
                'revenue' => round($revenue[$k] ?? 0, 2),
                'expenses' => round($expenses[$k] ?? 0, 2),
            ];
            $cursor = $granularity === 'day' ? $cursor->addDay() : $cursor->addMonth();
        }

        return $points;
    }

    /**
     * @return array{total: float, count: int, average: float, by_category: list<array<string, mixed>>, recent: list<array<string, mixed>>}
     */
    private function expenseSummary(CarbonImmutable $start, CarbonImmutable $end, float $total): array
    {
        $count = $this->expensesBetween($start, $end)->count();

        $byCategory = $this->expensesBetween($start, $end)
            ->with('category:id,name,color')
            ->get(['expense_category_id', 'amount'])
            ->groupBy('expense_category_id')
            ->map(fn (Collection $rows) => [
                'name' => $rows->first()->category?->name ?? 'Uncategorised',
                'color' => $rows->first()->category?->color ?? '#6B7280',
                'amount' => round((float) $rows->sum('amount'), 2),
            ])
            ->sortByDesc('amount')
            ->values()
            ->all();

        $recent = $this->expensesBetween($start, $end)
            ->with('category:id,name,color')
            ->latest('expense_date')
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(fn (Expense $e) => [
                'id' => $e->id,
                'title' => $e->title,
                'amount' => $e->amount,
                'expense_date' => $e->expense_date->toDateString(),
                'category' => $e->category?->name,
                'color' => $e->category?->color,
            ])
            ->all();

        return [
            'total' => $total,
            'count' => $count,
            'average' => $count > 0 ? round($total / $count, 2) : 0.0,
            'by_category' => $byCategory,
            'recent' => $recent,
        ];
    }

    private function rangeLabel(string $period, CarbonImmutable $start, CarbonImmutable $end): string
    {
        return match (true) {
            $period === 'today' => 'Today, '.$start->format('M j, Y'),
            $start->isSameDay($end) => $start->format('M j, Y'),
            $period === 'month' => $start->format('F Y'),
            default => $start->format('M j').' – '.$end->format('M j, Y'),
        };
    }
}
