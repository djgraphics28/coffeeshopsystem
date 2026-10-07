<?php

namespace App\Actions\Reports;

use App\Models\Attendance;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\PayrollRun;
use App\Models\Payslip;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use InvalidArgumentException;

/**
 * Builds every report as the same plain shape (summary cards, columns, rows, optional totals), so one screen and one
 * CSV export can show all of them. Sales figures count completed orders only, matching the dashboard.
 *
 * @phpstan-type Column array{key: string, label: string, type: 'text'|'money'|'int'|'percent'|'date', align?: 'right'}
 */
class ReportBuilder
{
    /** @var array<string, array<string, array{title: string, description: string}>> */
    public const CATALOG = [
        'Sales' => [
            'sales-summary' => ['title' => 'Sales Report', 'description' => 'Daily sales, discounts, tax and average order value.'],
            'sales-by-item' => ['title' => 'Sales by Item', 'description' => 'Every menu item with quantity sold and sales, best sellers first.'],
            'sales-by-category' => ['title' => 'Sales by Category', 'description' => 'How much each menu category sold.'],
            'sales-by-payment' => ['title' => 'Sales by Payment Method', 'description' => 'Cash, card, GCash and Maya totals.'],
            'sales-by-order-type' => ['title' => 'Sales by Order Type', 'description' => 'Dine-in, takeout, walk-in and delivery.'],
            'sales-by-hour' => ['title' => 'Sales by Hour', 'description' => 'Busiest hours of the day.'],
            'sales-by-weekday' => ['title' => 'Sales by Day of Week', 'description' => 'Which weekdays bring in the most.'],
            'sales-by-cashier' => ['title' => 'Sales by Cashier', 'description' => 'Orders and sales per staff member (online orders listed separately).'],
        ],
        'Customers & Promos' => [
            'top-customers' => ['title' => 'Top Customers', 'description' => 'Customers ranked by how much they spent.'],
            'discounts-promos' => ['title' => 'Discounts & Promos', 'description' => 'Discount given per promo code and manual discounts.'],
            'voids-cancellations' => ['title' => 'Voids & Cancellations', 'description' => 'Voided and cancelled orders with the reason.'],
        ],
        'Expenses' => [
            'expense-summary' => ['title' => 'Expense Report', 'description' => 'Expenses grouped by category.'],
            'expense-detail' => ['title' => 'Expense Details', 'description' => 'Every expense entry in the period.'],
        ],
        'Salary & Staff' => [
            'salary-summary' => ['title' => 'Salary Report', 'description' => 'Payroll runs that cover the period: gross pay, deductions and net pay.'],
            'salary-by-employee' => ['title' => 'Salary by Employee', 'description' => 'Approved and paid payslips added up per employee.'],
            'attendance-summary' => ['title' => 'Attendance Summary', 'description' => 'Days present, hours worked, late and overtime per employee.'],
        ],
        'Financial' => [
            'profit-loss' => ['title' => 'Profit & Loss', 'description' => 'Sales less expenses and salaries.'],
        ],
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return collect(self::CATALOG)->flatMap(fn (array $reports) => array_keys($reports))->values()->all();
    }

    /**
     * @return array{key: string, title: string, description: string, summary: list<array<string, mixed>>, columns: list<array<string, mixed>>, rows: list<array<string, mixed>>, totals: array<string, mixed>|null}
     */
    public function build(string $key, CarbonImmutable $start, CarbonImmutable $end): array
    {
        $meta = collect(self::CATALOG)->flatMap(fn (array $reports) => $reports)->get($key)
            ?? throw new InvalidArgumentException("Unknown report [{$key}].");

        $result = match ($key) {
            'sales-summary' => $this->salesSummary($start, $end),
            'sales-by-item' => $this->salesByItem($start, $end),
            'sales-by-category' => $this->salesByCategory($start, $end),
            'sales-by-payment' => $this->salesByPayment($start, $end),
            'sales-by-order-type' => $this->salesByOrderType($start, $end),
            'sales-by-hour' => $this->salesByHour($start, $end),
            'sales-by-weekday' => $this->salesByWeekday($start, $end),
            'sales-by-cashier' => $this->salesByCashier($start, $end),
            'top-customers' => $this->topCustomers($start, $end),
            'discounts-promos' => $this->discountsPromos($start, $end),
            'voids-cancellations' => $this->voidsCancellations($start, $end),
            'expense-summary' => $this->expenseSummary($start, $end),
            'expense-detail' => $this->expenseDetail($start, $end),
            'salary-summary' => $this->salarySummary($start, $end),
            'salary-by-employee' => $this->salaryByEmployee($start, $end),
            'attendance-summary' => $this->attendanceSummary($start, $end),
            'profit-loss' => $this->profitLoss($start, $end),
        };

        return ['key' => $key, 'title' => $meta['title'], 'description' => $meta['description']] + $result + ['totals' => null];
    }

    /** @return Builder<Order> */
    private function completedOrders(CarbonImmutable $start, CarbonImmutable $end): Builder
    {
        return Order::query()->whereBetween('created_at', [$start, $end])->where('status', 'completed');
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    private function sumTotals(Collection $rows, array $sumKeys, string $labelKey): array
    {
        $totals = [$labelKey => 'Total'];

        foreach ($sumKeys as $key) {
            $totals[$key] = round((float) $rows->sum($key), 2);
        }

        return $totals;
    }

    /** @return array<string, mixed> */
    private function col(string $key, string $label, string $type = 'text'): array
    {
        return ['key' => $key, 'label' => $label, 'type' => $type] + ($type === 'text' || $type === 'date' ? [] : ['align' => 'right']);
    }

    private function share(float $part, float $whole): float
    {
        return $whole > 0 ? round($part / $whole * 100, 1) : 0.0;
    }

    /** @return array<string, mixed> */
    private function salesSummary(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->get(['id', 'created_at', 'subtotal', 'discount', 'tax', 'delivery_fee', 'total']);

        $rows = $orders->groupBy(fn (Order $o) => $o->created_at->toDateString())->sortKeys()->map(function (Collection $day, string $date) {
            return [
                'date' => $date,
                'orders' => $day->count(),
                'subtotal' => round((float) $day->sum('subtotal'), 2),
                'discount' => round((float) $day->sum('discount'), 2),
                'tax' => round((float) $day->sum('tax'), 2),
                'delivery_fee' => round((float) $day->sum('delivery_fee'), 2),
                'total' => round((float) $day->sum('total'), 2),
                'average' => round((float) $day->avg('total'), 2),
            ];
        })->values();

        $total = (float) $orders->sum('total');

        return [
            'summary' => [
                ['label' => 'Total sales', 'value' => round($total, 2), 'type' => 'money'],
                ['label' => 'Orders', 'value' => $orders->count(), 'type' => 'int'],
                ['label' => 'Average order', 'value' => $orders->isEmpty() ? 0 : round($total / $orders->count(), 2), 'type' => 'money'],
                ['label' => 'Discounts given', 'value' => round((float) $orders->sum('discount'), 2), 'type' => 'money'],
            ],
            'columns' => [
                $this->col('date', 'Date', 'date'), $this->col('orders', 'Orders', 'int'), $this->col('subtotal', 'Subtotal', 'money'),
                $this->col('discount', 'Discounts', 'money'), $this->col('tax', 'Tax', 'money'), $this->col('delivery_fee', 'Delivery fees', 'money'),
                $this->col('total', 'Total sales', 'money'), $this->col('average', 'Avg order', 'money'),
            ],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'subtotal', 'discount', 'tax', 'delivery_fee', 'total'], 'date')
                + ['average' => $orders->isEmpty() ? 0 : round($total / $orders->count(), 2)],
        ];
    }

    /** @return Collection<int, OrderItem> */
    private function soldItems(CarbonImmutable $start, CarbonImmutable $end): Collection
    {
        return OrderItem::query()
            ->with('menuItem.category:id,name')
            ->whereHas('order', fn ($q) => $q->whereBetween('created_at', [$start, $end])->where('status', 'completed'))
            ->get();
    }

    /** @return array<string, mixed> */
    private function salesByItem(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $items = $this->soldItems($start, $end);
        $grand = (float) $items->sum('subtotal');

        $rows = $items->groupBy('menu_item_id')->map(fn (Collection $group) => [
            'item' => $group->first()->menuItem?->name ?? 'Deleted item',
            'category' => $group->first()->menuItem?->category?->name ?? '—',
            'quantity' => (int) $group->sum('quantity'),
            'sales' => round((float) $group->sum('subtotal'), 2),
            'share' => $this->share((float) $group->sum('subtotal'), $grand),
        ])->sortByDesc('quantity')->values();

        return [
            'summary' => [
                ['label' => 'Items sold', 'value' => (int) $items->sum('quantity'), 'type' => 'int'],
                ['label' => 'Item sales', 'value' => round($grand, 2), 'type' => 'money'],
                ['label' => 'Different items', 'value' => $rows->count(), 'type' => 'int'],
                ['label' => 'Best seller', 'value' => $rows->first()['item'] ?? '—', 'type' => 'text'],
            ],
            'columns' => [$this->col('item', 'Item'), $this->col('category', 'Category'), $this->col('quantity', 'Qty sold', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('share', '% of sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['quantity', 'sales'], 'item') + ['share' => $rows->isEmpty() ? 0 : 100.0],
        ];
    }

    /** @return array<string, mixed> */
    private function salesByCategory(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $items = $this->soldItems($start, $end);
        $grand = (float) $items->sum('subtotal');

        $rows = $items->groupBy(fn (OrderItem $i) => $i->menuItem?->category?->name ?? 'Uncategorized')->map(fn (Collection $group, string $name) => [
            'category' => $name,
            'quantity' => (int) $group->sum('quantity'),
            'sales' => round((float) $group->sum('subtotal'), 2),
            'share' => $this->share((float) $group->sum('subtotal'), $grand),
        ])->sortByDesc('sales')->values();

        return [
            'summary' => [
                ['label' => 'Categories sold', 'value' => $rows->count(), 'type' => 'int'],
                ['label' => 'Top category', 'value' => $rows->first()['category'] ?? '—', 'type' => 'text'],
                ['label' => 'Item sales', 'value' => round($grand, 2), 'type' => 'money'],
            ],
            'columns' => [$this->col('category', 'Category'), $this->col('quantity', 'Qty sold', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('share', '% of sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['quantity', 'sales'], 'category') + ['share' => $rows->isEmpty() ? 0 : 100.0],
        ];
    }

    /** @return array<string, mixed> */
    private function salesByPayment(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $payments = Payment::query()->with('order:id,total')
            ->whereHas('order', fn ($q) => $q->whereBetween('created_at', [$start, $end])->where('status', 'completed'))
            ->get();

        $grand = (float) $payments->sum(fn (Payment $p) => $p->order?->total ?? 0);

        $rows = $payments->groupBy('method')->map(function (Collection $group, string $method) use ($grand) {
            $sales = (float) $group->sum(fn (Payment $p) => $p->order?->total ?? 0);

            return ['method' => ucfirst($method), 'orders' => $group->count(), 'sales' => round($sales, 2), 'share' => $this->share($sales, $grand)];
        })->sortByDesc('sales')->values();

        $unpaid = $this->completedOrders($start, $end)->whereDoesntHave('payment')->get(['total']);

        if ($unpaid->isNotEmpty()) {
            $rows->push(['method' => 'No payment recorded', 'orders' => $unpaid->count(), 'sales' => round((float) $unpaid->sum('total'), 2), 'share' => 0.0]);
        }

        return [
            'summary' => [
                ['label' => 'Paid sales', 'value' => round($grand, 2), 'type' => 'money'],
                ['label' => 'Paid orders', 'value' => $payments->count(), 'type' => 'int'],
                ['label' => 'Top method', 'value' => $rows->first()['method'] ?? '—', 'type' => 'text'],
            ],
            'columns' => [$this->col('method', 'Payment method'), $this->col('orders', 'Orders', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('share', '% of paid sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'sales'], 'method'),
        ];
    }

    /** @return array<string, mixed> */
    private function salesByOrderType(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->get(['type', 'total']);
        $grand = (float) $orders->sum('total');

        $rows = $orders->groupBy('type')->map(fn (Collection $group, string $type) => [
            'type' => ucwords(str_replace(['-', '_'], ' ', $type)),
            'orders' => $group->count(),
            'sales' => round((float) $group->sum('total'), 2),
            'average' => round((float) $group->avg('total'), 2),
            'share' => $this->share((float) $group->sum('total'), $grand),
        ])->sortByDesc('sales')->values();

        return [
            'summary' => [['label' => 'Total sales', 'value' => round($grand, 2), 'type' => 'money'], ['label' => 'Orders', 'value' => $orders->count(), 'type' => 'int']],
            'columns' => [$this->col('type', 'Order type'), $this->col('orders', 'Orders', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('average', 'Avg order', 'money'), $this->col('share', '% of sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'sales'], 'type'),
        ];
    }

    /** @return array<string, mixed> */
    private function salesByHour(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->get(['created_at', 'total']);
        $grand = (float) $orders->sum('total');
        $byHour = $orders->groupBy(fn (Order $o) => (int) $o->created_at->format('G'));

        $rows = $byHour->sortKeys()->map(fn (Collection $group, int $hour) => [
            'hour' => CarbonImmutable::createFromTime($hour)->format('g:00 A').' – '.CarbonImmutable::createFromTime($hour)->addHour()->format('g:00 A'),
            'orders' => $group->count(),
            'sales' => round((float) $group->sum('total'), 2),
            'share' => $this->share((float) $group->sum('total'), $grand),
        ])->values();

        $busiest = $byHour->sortByDesc(fn (Collection $g) => $g->sum('total'))->keys()->first();

        return [
            'summary' => [
                ['label' => 'Busiest hour', 'value' => $busiest === null ? '—' : CarbonImmutable::createFromTime((int) $busiest)->format('g:00 A'), 'type' => 'text'],
                ['label' => 'Total sales', 'value' => round($grand, 2), 'type' => 'money'],
            ],
            'columns' => [$this->col('hour', 'Hour'), $this->col('orders', 'Orders', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('share', '% of sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'sales'], 'hour'),
        ];
    }

    /** @return array<string, mixed> */
    private function salesByWeekday(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->get(['created_at', 'total']);
        $grand = (float) $orders->sum('total');
        $byDay = $orders->groupBy(fn (Order $o) => $o->created_at->dayOfWeekIso);

        $rows = collect(range(1, 7))->filter(fn (int $d) => $byDay->has($d))->map(function (int $d) use ($byDay, $grand) {
            $group = $byDay[$d];

            return [
                'day' => CarbonImmutable::parse('monday this week')->addDays($d - 1)->format('l'),
                'orders' => $group->count(),
                'sales' => round((float) $group->sum('total'), 2),
                'average' => round((float) $group->avg('total'), 2),
                'share' => $this->share((float) $group->sum('total'), $grand),
            ];
        })->values();

        return [
            'summary' => [
                ['label' => 'Best day', 'value' => $rows->sortByDesc('sales')->first()['day'] ?? '—', 'type' => 'text'],
                ['label' => 'Total sales', 'value' => round($grand, 2), 'type' => 'money'],
            ],
            'columns' => [$this->col('day', 'Day'), $this->col('orders', 'Orders', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('average', 'Avg order', 'money'), $this->col('share', '% of sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'sales'], 'day'),
        ];
    }

    /** @return array<string, mixed> */
    private function salesByCashier(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->with('creator:id,name')->get(['id', 'created_by', 'total', 'discount']);
        $grand = (float) $orders->sum('total');

        $rows = $orders->groupBy('created_by')->map(fn (Collection $group) => [
            'cashier' => $group->first()->creator?->name ?? 'Online / self-order',
            'orders' => $group->count(),
            'sales' => round((float) $group->sum('total'), 2),
            'discount' => round((float) $group->sum('discount'), 2),
            'average' => round((float) $group->avg('total'), 2),
            'share' => $this->share((float) $group->sum('total'), $grand),
        ])->sortByDesc('sales')->values();

        return [
            'summary' => [['label' => 'Total sales', 'value' => round($grand, 2), 'type' => 'money'], ['label' => 'Orders', 'value' => $orders->count(), 'type' => 'int']],
            'columns' => [$this->col('cashier', 'Cashier'), $this->col('orders', 'Orders', 'int'), $this->col('sales', 'Sales', 'money'), $this->col('discount', 'Discounts', 'money'), $this->col('average', 'Avg order', 'money'), $this->col('share', '% of sales', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'sales', 'discount'], 'cashier'),
        ];
    }

    /** @return array<string, mixed> */
    private function topCustomers(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->whereNotNull('customer_id')->with('customer:id,name,phone,email')->get(['id', 'customer_id', 'total']);

        $rows = $orders->groupBy('customer_id')->map(fn (Collection $group) => [
            'customer' => $group->first()->customer?->name ?? 'Deleted customer',
            'contact' => $group->first()->customer?->phone ?: ($group->first()->customer?->email ?? '—'),
            'orders' => $group->count(),
            'spent' => round((float) $group->sum('total'), 2),
            'average' => round((float) $group->avg('total'), 2),
        ])->sortByDesc('spent')->take(50)->values();

        return [
            'summary' => [['label' => 'Customers who ordered', 'value' => $orders->pluck('customer_id')->unique()->count(), 'type' => 'int'], ['label' => 'Spent by members', 'value' => round((float) $orders->sum('total'), 2), 'type' => 'money']],
            'columns' => [$this->col('customer', 'Customer'), $this->col('contact', 'Contact'), $this->col('orders', 'Orders', 'int'), $this->col('spent', 'Total spent', 'money'), $this->col('average', 'Avg order', 'money')],
            'rows' => $rows->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function discountsPromos(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = $this->completedOrders($start, $end)->where('discount', '>', 0)->with('promo:id,code,name')->get(['id', 'promo_id', 'discount', 'total']);

        $rows = $orders->groupBy(fn (Order $o) => $o->promo_id ?? 0)->map(fn (Collection $group) => [
            'promo' => $group->first()->promo ? $group->first()->promo->code.' — '.$group->first()->promo->name : 'Manual / loyalty discount',
            'orders' => $group->count(),
            'discount' => round((float) $group->sum('discount'), 2),
            'sales' => round((float) $group->sum('total'), 2),
        ])->sortByDesc('discount')->values();

        return [
            'summary' => [['label' => 'Discounts given', 'value' => round((float) $orders->sum('discount'), 2), 'type' => 'money'], ['label' => 'Discounted orders', 'value' => $orders->count(), 'type' => 'int']],
            'columns' => [$this->col('promo', 'Promo'), $this->col('orders', 'Orders', 'int'), $this->col('discount', 'Discount given', 'money'), $this->col('sales', 'Sales after discount', 'money')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['orders', 'discount', 'sales'], 'promo'),
        ];
    }

    /** @return array<string, mixed> */
    private function voidsCancellations(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $orders = Order::query()->whereBetween('created_at', [$start, $end])->whereIn('status', ['voided', 'cancelled'])
            ->with('voidedBy:id,name')->latest()->get(['id', 'order_number', 'created_at', 'status', 'void_reason', 'voided_by', 'total']);

        $rows = $orders->map(fn (Order $o) => [
            'order' => $o->order_number,
            'date' => $o->created_at->format('Y-m-d H:i'),
            'status' => ucfirst($o->status),
            'reason' => $o->void_reason ?: '—',
            'by' => $o->voidedBy?->name ?? '—',
            'total' => round((float) $o->total, 2),
        ])->values();

        return [
            'summary' => [
                ['label' => 'Voided', 'value' => $orders->where('status', 'voided')->count(), 'type' => 'int'],
                ['label' => 'Cancelled', 'value' => $orders->where('status', 'cancelled')->count(), 'type' => 'int'],
                ['label' => 'Value lost', 'value' => round((float) $orders->sum('total'), 2), 'type' => 'money'],
            ],
            'columns' => [$this->col('order', 'Order'), $this->col('date', 'Date'), $this->col('status', 'Status'), $this->col('reason', 'Reason'), $this->col('by', 'Voided by'), $this->col('total', 'Total', 'money')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['total'], 'order'),
        ];
    }

    /** @return Collection<int, Expense> */
    private function expensesBetween(CarbonImmutable $start, CarbonImmutable $end): Collection
    {
        return Expense::query()->with(['category:id,name', 'user:id,name'])
            ->whereDate('expense_date', '>=', $start->toDateString())->whereDate('expense_date', '<=', $end->toDateString())
            ->orderBy('expense_date')->get();
    }

    /** @return array<string, mixed> */
    private function expenseSummary(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $expenses = $this->expensesBetween($start, $end);
        $grand = (float) $expenses->sum('amount');

        $rows = $expenses->groupBy(fn (Expense $e) => $e->category?->name ?? 'Uncategorized')->map(fn (Collection $group, string $name) => [
            'category' => $name,
            'entries' => $group->count(),
            'amount' => round((float) $group->sum('amount'), 2),
            'share' => $this->share((float) $group->sum('amount'), $grand),
        ])->sortByDesc('amount')->values();

        return [
            'summary' => [
                ['label' => 'Total expenses', 'value' => round($grand, 2), 'type' => 'money'],
                ['label' => 'Entries', 'value' => $expenses->count(), 'type' => 'int'],
                ['label' => 'Biggest category', 'value' => $rows->first()['category'] ?? '—', 'type' => 'text'],
            ],
            'columns' => [$this->col('category', 'Category'), $this->col('entries', 'Entries', 'int'), $this->col('amount', 'Amount', 'money'), $this->col('share', '% of expenses', 'percent')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['entries', 'amount'], 'category') + ['share' => $rows->isEmpty() ? 0 : 100.0],
        ];
    }

    /** @return array<string, mixed> */
    private function expenseDetail(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $expenses = $this->expensesBetween($start, $end);

        $rows = $expenses->map(fn (Expense $e) => [
            'date' => $e->expense_date->toDateString(),
            'title' => $e->title,
            'category' => $e->category?->name ?? 'Uncategorized',
            'reference' => $e->reference_no ?: '—',
            'by' => $e->user?->name ?? '—',
            'amount' => round((float) $e->amount, 2),
        ])->values();

        return [
            'summary' => [['label' => 'Total expenses', 'value' => round((float) $expenses->sum('amount'), 2), 'type' => 'money'], ['label' => 'Entries', 'value' => $expenses->count(), 'type' => 'int']],
            'columns' => [$this->col('date', 'Date', 'date'), $this->col('title', 'Title'), $this->col('category', 'Category'), $this->col('reference', 'Reference'), $this->col('by', 'Recorded by'), $this->col('amount', 'Amount', 'money')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['amount'], 'date'),
        ];
    }

    /** @return Builder<PayrollRun> */
    private function runsOverlapping(CarbonImmutable $start, CarbonImmutable $end): Builder
    {
        return PayrollRun::query()->whereDate('period_start', '<=', $end->toDateString())->whereDate('period_end', '>=', $start->toDateString());
    }

    /** @return array<string, mixed> */
    private function salarySummary(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $runs = $this->runsOverlapping($start, $end)->withCount('payslips')
            ->withSum('payslips as gross_total', 'gross_pay')->withSum('payslips as deduction_total', 'total_deductions')->withSum('payslips as net_total', 'net_pay')
            ->orderBy('period_start')->get();

        $rows = $runs->map(fn (PayrollRun $r) => [
            'reference' => $r->reference,
            'period' => $r->period_start->format('M j').' – '.$r->period_end->format('M j, Y'),
            'frequency' => ucwords(str_replace('_', ' ', $r->frequency)),
            'status' => ucfirst($r->status),
            'employees' => (int) $r->payslips_count,
            'gross' => round((float) $r->gross_total, 2),
            'deductions' => round((float) $r->deduction_total, 2),
            'net' => round((float) $r->net_total, 2),
        ])->values();

        $counted = $runs->whereIn('status', ['approved', 'paid']);

        return [
            'summary' => [
                ['label' => 'Net pay (approved & paid)', 'value' => round((float) $counted->sum('net_total'), 2), 'type' => 'money'],
                ['label' => 'Gross pay (approved & paid)', 'value' => round((float) $counted->sum('gross_total'), 2), 'type' => 'money'],
                ['label' => 'Payroll runs', 'value' => $runs->count(), 'type' => 'int'],
            ],
            'columns' => [$this->col('reference', 'Reference'), $this->col('period', 'Period'), $this->col('frequency', 'Frequency'), $this->col('status', 'Status'), $this->col('employees', 'Employees', 'int'), $this->col('gross', 'Gross pay', 'money'), $this->col('deductions', 'Deductions', 'money'), $this->col('net', 'Net pay', 'money')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows->whereIn('status', ['Approved', 'Paid']), ['gross', 'deductions', 'net'], 'reference'),
        ];
    }

    /** @return array<string, mixed> */
    private function salaryByEmployee(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $payslips = Payslip::query()
            ->whereHas('run', fn ($q) => $q->whereDate('period_start', '<=', $end->toDateString())->whereDate('period_end', '>=', $start->toDateString())->whereIn('status', ['approved', 'paid']))
            ->get();

        $rows = $payslips->groupBy('employee_id')->map(fn (Collection $group) => [
            'employee' => $group->last()->employee_name,
            'code' => $group->last()->employee_code,
            'position' => $group->last()->position ?: '—',
            'payslips' => $group->count(),
            'days' => round((float) $group->sum('days_worked'), 2),
            'gross' => round((float) $group->sum('gross_pay'), 2),
            'deductions' => round((float) $group->sum('total_deductions'), 2),
            'net' => round((float) $group->sum('net_pay'), 2),
        ])->sortBy('employee')->values();

        return [
            'summary' => [
                ['label' => 'Total net pay', 'value' => round((float) $rows->sum('net'), 2), 'type' => 'money'],
                ['label' => 'Total gross pay', 'value' => round((float) $rows->sum('gross'), 2), 'type' => 'money'],
                ['label' => 'Employees paid', 'value' => $rows->count(), 'type' => 'int'],
            ],
            'columns' => [$this->col('employee', 'Employee'), $this->col('code', 'Code'), $this->col('position', 'Position'), $this->col('payslips', 'Payslips', 'int'), $this->col('days', 'Days worked', 'int'), $this->col('gross', 'Gross pay', 'money'), $this->col('deductions', 'Deductions', 'money'), $this->col('net', 'Net pay', 'money')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['payslips', 'gross', 'deductions', 'net'], 'employee'),
        ];
    }

    /** @return array<string, mixed> */
    private function attendanceSummary(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $records = Attendance::query()->with('employee:id,first_name,last_name,employee_code')
            ->whereDate('work_date', '>=', $start->toDateString())->whereDate('work_date', '<=', $end->toDateString())->get();

        $rows = $records->groupBy('employee_id')->map(fn (Collection $group) => [
            'employee' => $group->first()->employee?->full_name ?? 'Deleted employee',
            'code' => $group->first()->employee?->employee_code ?? '—',
            'days' => $group->count(),
            'hours' => round($group->sum('worked_minutes') / 60, 1),
            'late' => (int) $group->sum('late_minutes'),
            'overtime' => round($group->sum('overtime_minutes') / 60, 1),
        ])->sortBy('employee')->values();

        return [
            'summary' => [
                ['label' => 'Employees with attendance', 'value' => $rows->count(), 'type' => 'int'],
                ['label' => 'Hours worked', 'value' => round((float) $rows->sum('hours'), 1), 'type' => 'int'],
                ['label' => 'Late minutes', 'value' => (int) $rows->sum('late'), 'type' => 'int'],
            ],
            'columns' => [$this->col('employee', 'Employee'), $this->col('code', 'Code'), $this->col('days', 'Days present', 'int'), $this->col('hours', 'Hours worked', 'int'), $this->col('late', 'Late (min)', 'int'), $this->col('overtime', 'Overtime (hrs)', 'int')],
            'rows' => $rows->all(),
            'totals' => $this->sumTotals($rows, ['days', 'hours', 'late', 'overtime'], 'employee'),
        ];
    }

    /** @return array<string, mixed> */
    private function profitLoss(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $sales = (float) $this->completedOrders($start, $end)->sum('total');
        $expenses = (float) $this->expensesBetween($start, $end)->sum('amount');
        $salaries = (float) Payslip::query()
            ->whereHas('run', fn ($q) => $q->whereDate('period_end', '>=', $start->toDateString())->whereDate('period_end', '<=', $end->toDateString())->whereIn('status', ['approved', 'paid']))
            ->sum('gross_pay');
        $profit = $sales - $expenses - $salaries;

        $rows = collect([
            ['line' => 'Sales (completed orders)', 'amount' => $sales],
            ['line' => 'Less: operating expenses', 'amount' => -$expenses],
            ['line' => 'Less: salaries (approved & paid payroll ending in the period)', 'amount' => -$salaries],
            ['line' => $profit >= 0 ? 'Net profit' : 'Net loss', 'amount' => $profit],
        ])->map(fn (array $r) => ['line' => $r['line'], 'amount' => round($r['amount'], 2)]);

        return [
            'summary' => [
                ['label' => 'Sales', 'value' => round($sales, 2), 'type' => 'money'],
                ['label' => 'Expenses + salaries', 'value' => round($expenses + $salaries, 2), 'type' => 'money'],
                ['label' => 'Net profit', 'value' => round($profit, 2), 'type' => 'money'],
                ['label' => 'Profit margin', 'value' => $this->share($profit, $sales), 'type' => 'percent'],
            ],
            'columns' => [$this->col('line', 'Line'), $this->col('amount', 'Amount', 'money')],
            'rows' => $rows->all(),
        ];
    }
}
