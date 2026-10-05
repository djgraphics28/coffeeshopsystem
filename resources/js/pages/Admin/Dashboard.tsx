import { Head, Link, router } from '@inertiajs/react';
import type { VariantProps } from 'class-variance-authority';
import { BarChart2, CalendarRange, Receipt, ShoppingBag, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { PageHeader } from '@/components/admin/page-header';
import { Badge  } from '@/components/ui/badge';
import type {badgeVariants} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminDashboard } from '@/lib/routes';
import { cn } from '@/lib/utils';

type Period = 'today' | 'week' | 'month' | 'custom';

interface Trends { revenue: number | null; order_count: number | null; avg_order_value: number | null; expenses: number | null; net: number | null }

interface Stats {
    revenue: number;
    order_count: number;
    avg_order_value: number;
    expenses: number;
    net: number;
    trends: Trends;
}

interface RecentOrder {
    id: number;
    order_number: string;
    status: string;
    type: string;
    total: number;
    table_name: string;
    items_count: number;
    created_at: string;
}

interface TopItem { name: string; total_sold: number; revenue: number }
interface SeriesPoint { label: string; revenue: number; expenses: number }
interface ExpenseSummary {
    total: number;
    count: number;
    average: number;
    by_category: Array<{ name: string; color: string; amount: number }>;
    recent: Array<{ id: number; title: string; amount: number; expense_date: string; category: string | null; color: string | null }>;
}

interface Props {
    filters: { period: Period; from: string; to: string };
    range: { label: string; days: number; granularity: 'hour' | 'day' | 'month' };
    currency: string;
    can: { view_expenses: boolean };
    stats: Stats;
    series: SeriesPoint[];
    orders_by_status: Record<string, number>;
    recent_orders: RecentOrder[];
    top_items: TopItem[];
    expense_summary: ExpenseSummary | null;
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'var(--color-warning)',
    preparing: 'var(--color-info)',
    ready: 'var(--color-success)',
    completed: 'var(--color-muted-foreground)',
    cancelled: 'var(--color-error)',
    voided: 'var(--color-error)',
};

const STATUS_VARIANT: Record<string, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
    pending: 'warning',
    preparing: 'info',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'error',
    voided: 'error',
};

const PERIODS: Array<{ id: Exclude<Period, 'custom'>; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
];

const TOOLTIP_STYLE = { background: 'var(--ap-card)', border: '1px solid var(--ap-border)', borderRadius: 12, fontSize: 12 };

export default function Dashboard({ filters, range, currency, can, stats, series, orders_by_status, recent_orders, top_items, expense_summary }: Props) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [customOpen, setCustomOpen] = useState(filters.period === 'custom');

    const money = (v: number | string) => `${currency}${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const compact = (v: number) => (Math.abs(v) >= 1000 ? `${currency}${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${currency}${v}`);

    function go(params: Record<string, string>) {
        router.get(adminDashboard(), params, { preserveScroll: true, preserveState: true, replace: true });
    }

    function selectPeriod(period: Exclude<Period, 'custom'>) {
        setCustomOpen(false);
        go({ period });
    }

    const customInvalid = !from || !to || from > to;
    const periodLabel = range.granularity === 'hour' ? 'previous day' : 'previous period';

    const pieData = Object.entries(orders_by_status)
        .filter(([, v]) => v > 0)
        .map(([status, count]) => ({ name: status, value: count, color: STATUS_COLORS[status] ?? 'var(--color-muted-foreground)' }));

    const barData = top_items.slice(0, 7).map((item) => ({
        name: item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name,
        sold: item.total_sold,
    }));

    const showExpenseSeries = can.view_expenses && range.granularity !== 'hour';
    const hasSeriesData = series.some((p) => p.revenue > 0 || p.expenses > 0);

    return (
        <AdminLayout>
            <Head title="Dashboard" />

            <PageHeader title="Dashboard" />
            <p className="-mt-4 mb-4 text-sm text-muted-foreground">Welcome back! Here's what's happening — <span className="font-medium text-foreground">{range.label}</span>.</p>

            {/* ── Period filter ── */}
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div role="tablist" aria-label="Period" className="flex gap-1 rounded-xl bg-muted p-1">
                    {PERIODS.map((p) => (
                        <button
                            key={p.id} role="tab" aria-selected={filters.period === p.id && !customOpen} onClick={() => selectPeriod(p.id)}
                            className={cn('h-9 rounded-lg px-4 text-sm font-medium transition-all', filters.period === p.id && !customOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        role="tab" aria-selected={filters.period === 'custom' || customOpen} onClick={() => setCustomOpen((v) => !v)}
                        className={cn('flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-all', filters.period === 'custom' || customOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    >
                        <CalendarRange className="h-4 w-4" /> Date range
                    </button>
                </div>

                {customOpen && (
                    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
 e.preventDefault();

 if (!customInvalid) {
 go({ period: 'custom', from, to }); 
} 
}}>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">From
                            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-[var(--ap-input-border)] bg-transparent px-3 text-sm text-foreground outline-none focus:border-primary" />
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">To
                            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-[var(--ap-input-border)] bg-transparent px-3 text-sm text-foreground outline-none focus:border-primary" />
                        </label>
                        <Button type="submit" size="sm" disabled={customInvalid}>Apply</Button>
                    </form>
                )}

                <p className="ml-auto text-xs text-muted-foreground">Compared with the {periodLabel}</p>
            </div>

            {/* ── Stat Cards ── */}
            <div className={cn('mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2', can.view_expenses ? 'xl:grid-cols-5' : 'xl:grid-cols-3')}>
                <StatCard icon={TrendingUp} label="Revenue" value={money(stats.revenue)} trend={stats.trends.revenue} tone="brand" />
                <StatCard icon={ShoppingBag} label="Orders" value={stats.order_count.toLocaleString()} trend={stats.trends.order_count} tone="info" />
                <StatCard icon={BarChart2} label="Avg. Order Value" value={money(stats.avg_order_value)} trend={stats.trends.avg_order_value} tone="success" />
                {can.view_expenses && <StatCard icon={Receipt} label="Expenses" value={money(stats.expenses)} trend={stats.trends.expenses} tone="error" invert />}
                {can.view_expenses && <StatCard icon={Wallet} label="Net (Revenue − Expenses)" value={money(stats.net)} trend={stats.trends.net} tone={stats.net >= 0 ? 'success' : 'error'} />}
            </div>

            {/* ── Revenue vs expenses ── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className={cn('rounded-2xl border border-border bg-card p-5 shadow-sm', can.view_expenses ? 'xl:col-span-3' : 'xl:col-span-5')}>
                    <div className="mb-4">
                        <h2 className="font-semibold text-foreground">{showExpenseSeries ? 'Revenue vs Expenses' : range.granularity === 'hour' ? 'Sales by hour' : 'Revenue'}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {range.granularity === 'hour' ? 'Completed orders by hour of the day' : range.granularity === 'day' ? 'Per day' : 'Per month'}
                            {can.view_expenses && range.granularity === 'hour' && ' · expenses are recorded per day, see the cards above'}
                        </p>
                    </div>
                    {hasSeriesData ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={series} barGap={2} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--ap-border)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ap-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--ap-muted)' }} axisLine={false} tickLine={false} tickFormatter={compact} width={52} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--ap-border)' }} formatter={(v, name) => [money(Number(v)), name]} />
                                {showExpenseSeries && <Legend formatter={(v) => <span style={{ fontSize: 11, color: 'var(--ap-muted)' }}>{v}</span>} />}
                                <Bar dataKey="revenue" name="Revenue" fill="var(--color-primary)" radius={[5, 5, 0, 0]} />
                                {showExpenseSeries && <Bar dataKey="expenses" name="Expenses" fill="var(--color-error)" radius={[5, 5, 0, 0]} />}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No sales or expenses in this period" />
                    )}
                </div>

                {can.view_expenses && expense_summary && (
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                        <div className="mb-4 flex items-start justify-between">
                            <div>
                                <h2 className="font-semibold text-foreground">Expenses by Category</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">{expense_summary.count} expense{expense_summary.count === 1 ? '' : 's'} · avg {money(expense_summary.average)}</p>
                            </div>
                            <Link href="/admin/expenses" className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">View →</Link>
                        </div>
                        {expense_summary.by_category.length > 0 ? (
                            <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
                                <div className="h-40 w-40 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={expense_summary.by_category} dataKey="amount" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                                                {expense_summary.by_category.map((c) => <Cell key={c.name} fill={c.color} />)}
                                            </Pie>
                                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [money(Number(v)), name]} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <ul className="w-full min-w-0 flex-1 space-y-2">
                                    {expense_summary.by_category.slice(0, 6).map((c) => (
                                        <li key={c.name} className="flex items-center gap-2 text-sm">
                                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                                            <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">{expense_summary.total > 0 ? Math.round((c.amount / expense_summary.total) * 100) : 0}%</span>
                                            <span className="shrink-0 font-semibold text-foreground">{money(c.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <EmptyState label="No expenses in this period" />
                        )}
                    </div>
                )}
            </div>

            {/* ── Top items + status ── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-3">
                    <div className="mb-4">
                        <h2 className="font-semibold text-foreground">Top Selling Items</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Units sold · {range.label}</p>
                    </div>
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={barData} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--ap-border)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ap-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--ap-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--ap-border)' }} />
                                <Bar dataKey="sold" fill="var(--color-primary)" radius={[6, 6, 0, 0]} name="Units Sold" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No completed orders in this period" />
                    )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4">
                        <h2 className="font-semibold text-foreground">Orders by Status</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">{range.label}</p>
                    </div>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                </Pie>
                                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} orders`, '']} />
                                <Legend formatter={(v) => <span style={{ fontSize: 11, color: 'var(--ap-muted)', textTransform: 'capitalize' }}>{v}</span>} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No orders in this period" />
                    )}
                </div>
            </div>

            {/* ── Recent orders + best sellers ── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="xl:col-span-3">
                    <TableCard>
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <h2 className="font-semibold text-foreground">Recent Orders</h2>
                            <Link href="/admin/orders" className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">View All →</Link>
                        </div>
                        <TableScroll>
                            <Table>
                                <TableHead>
                                    <tr>{['Order #', 'Table', 'Items', 'Total', 'Status', 'Time'].map((h) => <TableHeadCell key={h}>{h}</TableHeadCell>)}</tr>
                                </TableHead>
                                <TableBody>
                                    {recent_orders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-xs font-bold whitespace-nowrap text-primary">{order.order_number}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{order.table_name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{order.items_count}</TableCell>
                                            <TableCell className="text-xs font-bold whitespace-nowrap">{money(order.total)}</TableCell>
                                            <TableCell><Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'} className="capitalize">{order.status}</Badge></TableCell>
                                            <TableCell className="text-[11px] whitespace-nowrap text-muted-foreground">
                                                {new Date(order.created_at).toLocaleString('en-PH', range.days > 1 ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {recent_orders.length === 0 && <TableEmpty colSpan={6}>No orders in this period</TableEmpty>}
                                </TableBody>
                            </Table>
                        </TableScroll>
                    </TableCard>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                    <h2 className="mb-4 font-semibold text-foreground">Best Sellers</h2>
                    {top_items.length > 0 ? (
                        <div className="space-y-3">
                            {top_items.slice(0, 6).map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold', i === 0 ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' : i === 2 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>{i + 1}</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.total_sold} sold</p>
                                    </div>
                                    <p className="shrink-0 text-sm font-bold text-primary">{money(item.revenue)}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState label="No completed orders in this period" />
                    )}
                </div>
            </div>

            {/* ── Recent expenses ── */}
            {can.view_expenses && expense_summary && (
                <TableCard>
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                        <div>
                            <h2 className="font-semibold text-foreground">Recent Expenses</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Total {money(expense_summary.total)} · {range.label}</p>
                        </div>
                        <Link href="/admin/expenses" className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">View All →</Link>
                    </div>
                    <TableScroll>
                        <Table>
                            <TableHead>
                                <tr>{['Date', 'Title', 'Category', 'Amount'].map((h) => <TableHeadCell key={h}>{h}</TableHeadCell>)}</tr>
                            </TableHead>
                            <TableBody>
                                {expense_summary.recent.map((e) => (
                                    <TableRow key={e.id}>
                                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{new Date(`${e.expense_date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                                        <TableCell className="text-sm font-medium">{e.title}</TableCell>
                                        <TableCell className="text-xs">
                                            {e.category ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: e.color ?? '#6B7280' }} />{e.category}</span> : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-sm font-bold whitespace-nowrap text-error">{money(e.amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {expense_summary.recent.length === 0 && <TableEmpty colSpan={4}>No expenses in this period</TableEmpty>}
                            </TableBody>
                        </Table>
                    </TableScroll>
                </TableCard>
            )}
        </AdminLayout>
    );
}

function StatCard({
    icon: Icon, label, value, trend, tone, invert = false,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    trend: number | null;
    tone: 'brand' | 'info' | 'success' | 'error';
    /** For costs, an increase is bad news, so the colours are swapped. */
    invert?: boolean;
}) {
    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        info: 'bg-info/10 text-info',
        success: 'bg-success/10 text-success',
        error: 'bg-error/10 text-error',
    };
    const isUp = (trend ?? 0) >= 0;
    const good = invert ? !isUp : isUp;

    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-2 truncate text-2xl font-bold text-foreground">{value}</p>
                    <div className="mt-2 flex items-center gap-1">
                        {trend === null ? (
                            <span className="text-[11px] text-muted-foreground">No earlier data to compare</span>
                        ) : (
                            <>
                                <span className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', trend === 0 ? 'bg-muted text-muted-foreground' : good ? 'bg-success/10 text-success' : 'bg-error/10 text-error')}>
                                    {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {Math.abs(trend)}%
                                </span>
                                <span className="text-[11px] text-muted-foreground">vs before</span>
                            </>
                        )}
                    </div>
                </div>
                <div className={cn('shrink-0 rounded-xl p-2.5', toneClasses[tone])}><Icon className="h-5 w-5" /></div>
            </div>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{label}</div>;
}
