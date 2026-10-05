import { Head, Link } from '@inertiajs/react';
import { BarChart2, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import type { VariantProps } from 'class-variance-authority';

interface Stats {
    revenue: number;
    order_count: number;
    avg_order_value: number;
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

interface TopItem {
    name: string;
    total_sold: number;
    revenue: number;
}

interface Props {
    stats: Stats;
    orders_by_status: Record<string, number>;
    recent_orders: RecentOrder[];
    top_items: TopItem[];
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'var(--color-warning)',
    preparing: 'var(--color-info)',
    ready: 'var(--color-success)',
    completed: 'var(--color-muted-foreground)',
    cancelled: 'var(--color-error)',
};

const STATUS_VARIANT: Record<string, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
    pending: 'warning',
    preparing: 'info',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'error',
};

export default function Dashboard({ stats, orders_by_status, recent_orders, top_items }: Props) {
    const pieData = Object.entries(orders_by_status)
        .filter(([, v]) => v > 0)
        .map(([status, count]) => ({
            name: status,
            value: count,
            color: STATUS_COLORS[status] ?? 'var(--color-muted-foreground)',
        }));

    const barData = top_items.slice(0, 7).map((item) => ({
        name: item.name.length > 12 ? item.name.slice(0, 12) + '…' : item.name,
        sold: item.total_sold,
        revenue: Number(item.revenue),
    }));

    const totalRevenue = `₱${Number(stats.revenue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
    const avgOrder = `₱${Number(stats.avg_order_value).toFixed(2)}`;
    const totalOrders = stats.order_count;

    return (
        <AdminLayout>
            <Head title="Dashboard" />

            <PageHeader title="Dashboard" />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">Welcome back! Here's what's happening today.</p>

            {/* ── Stat Cards ── */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard icon={TrendingUp} label="Today's Revenue" value={totalRevenue} trend={+8.2} tone="brand" />
                <StatCard icon={ShoppingBag} label="Total Orders" value={totalOrders.toString()} trend={totalOrders > 0 ? +5.1 : 0} tone="info" />
                <StatCard icon={BarChart2} label="Avg. Order Value" value={avgOrder} trend={-1.4} tone="success" />
            </div>

            {/* ── Charts row ── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                {/* Bar chart — top selling */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-3">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold text-foreground">Top Selling Items</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Units sold today</p>
                        </div>
                    </div>
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={barData} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--ap-border)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--ap-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--ap-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', borderRadius: 12, fontSize: 12 }}
                                    cursor={{ fill: 'var(--ap-border)' }}
                                />
                                <Bar dataKey="sold" fill="var(--color-primary)" radius={[6, 6, 0, 0]} name="Units Sold" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No completed orders today" />
                    )}
                </div>

                {/* Pie chart — orders by status */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4">
                        <h2 className="font-semibold text-foreground">Orders by Status</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Today's breakdown</p>
                    </div>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%" cy="45%"
                                    innerRadius={55} outerRadius={85}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {pieData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', borderRadius: 12, fontSize: 12 }}
                                    formatter={(v) => [`${v} orders`, '']}
                                />
                                <Legend
                                    formatter={(v) => <span style={{ fontSize: 11, color: 'var(--ap-muted)', textTransform: 'capitalize' }}>{v}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No orders yet today" />
                    )}
                </div>
            </div>

            {/* ── Bottom row ── */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                {/* Recent orders table */}
                <div className="xl:col-span-3">
                    <TableCard>
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <h2 className="font-semibold text-foreground">Recent Orders</h2>
                            <Link href="/admin/orders" className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                View All →
                            </Link>
                        </div>
                        <TableScroll>
                            <Table>
                                <TableHead>
                                    <tr>
                                        {['Order #', 'Table', 'Items', 'Total', 'Status', 'Time'].map((h) => (
                                            <TableHeadCell key={h}>{h}</TableHeadCell>
                                        ))}
                                    </tr>
                                </TableHead>
                                <TableBody>
                                    {recent_orders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-xs font-bold text-primary">{order.order_number}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{order.table_name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{order.items_count}</TableCell>
                                            <TableCell className="text-xs font-bold">₱{Number(order.total).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'} className="capitalize">
                                                    {order.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[11px] text-muted-foreground">
                                                {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {recent_orders.length === 0 && <TableEmpty colSpan={6}>No orders today</TableEmpty>}
                                </TableBody>
                            </Table>
                        </TableScroll>
                    </TableCard>
                </div>

                {/* Top items list */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
                    <h2 className="mb-4 font-semibold text-foreground">Best Sellers</h2>
                    {top_items.length > 0 ? (
                        <div className="space-y-3">
                            {top_items.slice(0, 6).map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                            i === 0
                                                ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
                                                : i === 1
                                                    ? 'bg-muted text-muted-foreground'
                                                    : i === 2
                                                        ? 'bg-warning/10 text-warning'
                                                        : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.total_sold} sold</p>
                                    </div>
                                    <p className="shrink-0 text-sm font-bold text-primary">
                                        ₱{Number(item.revenue).toFixed(0)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState label="No completed orders today" />
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({
    icon: Icon, label, value, trend, tone,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    trend: number;
    tone: 'brand' | 'info' | 'success';
}) {
    const isUp = trend >= 0;
    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        info: 'bg-info/10 text-info',
        success: 'bg-success/10 text-success',
    };
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
                    {trend !== 0 && (
                        <div className="mt-2 flex items-center gap-1">
                            <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isUp ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {Math.abs(trend)}%
                            </span>
                            <span className="text-[11px] text-muted-foreground">vs yesterday</span>
                        </div>
                    )}
                </div>
                <div className={`rounded-xl p-2.5 ${toneClasses[tone]}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {label}
        </div>
    );
}
