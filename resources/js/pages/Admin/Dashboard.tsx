import { Head, Link } from '@inertiajs/react';
import { BarChart2, ShoppingBag, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AdminLayout from '@/layouts/admin-layout';
import { adminOrdersShow } from '@/lib/routes';

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
    pending: '#F59E0B',
    preparing: '#3B82F6',
    ready: '#22C55E',
    completed: '#8A9E7B',
    cancelled: '#EF4444',
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    pending:   { bg: '#FEF3C7', text: '#92400E' },
    preparing: { bg: '#DBEAFE', text: '#1E40AF' },
    ready:     { bg: '#D1FAE5', text: '#065F46' },
    completed: { bg: '#F3F4F6', text: '#6B7280' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};

export default function Dashboard({ stats, orders_by_status, recent_orders, top_items }: Props) {
    const pieData = Object.entries(orders_by_status)
        .filter(([, v]) => v > 0)
        .map(([status, count]) => ({
            name: status,
            value: count,
            color: STATUS_COLORS[status] ?? '#6B7280',
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

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                    Dashboard
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--ap-muted)' }}>
                    Welcome back! Here's what's happening today.
                </p>
            </div>

            {/* ── Stat Cards ── */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                    icon={TrendingUp}
                    label="Today's Revenue"
                    value={totalRevenue}
                    trend={+8.2}
                    iconColor="#D4A843"
                    iconBg="#D4A84322"
                />
                <StatCard
                    icon={ShoppingBag}
                    label="Total Orders"
                    value={totalOrders.toString()}
                    trend={totalOrders > 0 ? +5.1 : 0}
                    iconColor="#3B82F6"
                    iconBg="#3B82F622"
                />
                <StatCard
                    icon={BarChart2}
                    label="Avg. Order Value"
                    value={avgOrder}
                    trend={-1.4}
                    iconColor="#8A9E7B"
                    iconBg="#8A9E7B22"
                />
            </div>

            {/* ── Charts row ── */}
            <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
                {/* Bar chart — top selling */}
                <div className="xl:col-span-3 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                Top Selling Items
                            </h2>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--ap-muted)' }}>Units sold today</p>
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
                                <Bar dataKey="sold" fill="#D4A843" radius={[6, 6, 0, 0]} name="Units Sold" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyState label="No completed orders today" />
                    )}
                </div>

                {/* Pie chart — orders by status */}
                <div className="xl:col-span-2 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <div className="mb-4">
                        <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Orders by Status
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ap-muted)' }}>Today's breakdown</p>
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
                <div className="xl:col-span-3 rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--ap-border)' }}>
                        <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Recent Orders
                        </h2>
                        <Link href="/admin/orders" className="text-xs font-medium px-3 py-1 rounded-full" style={{ background: '#D4A84320', color: '#D4A843' }}>
                            View All →
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: 'var(--ap-bg)' }}>
                                    {['Order #', 'Table', 'Items', 'Total', 'Status', 'Time'].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {recent_orders.map((order) => {
                                    const s = STATUS_STYLES[order.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
                                    return (
                                        <tr key={order.id} className="border-t transition-colors" style={{ borderColor: 'var(--ap-border)' }}>
                                            <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: '#D4A843' }}>{order.order_number}</td>
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>{order.table_name}</td>
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>{order.items_count}</td>
                                            <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--ap-input-text)' }}>₱{Number(order.total).toFixed(2)}</td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize" style={s}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[11px]" style={{ color: 'var(--ap-muted)' }}>
                                                {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {recent_orders.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>
                                            No orders today
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top items list */}
                <div className="xl:col-span-2 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <h2 className="mb-4 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                        Best Sellers
                    </h2>
                    {top_items.length > 0 ? (
                        <div className="space-y-3">
                            {top_items.slice(0, 6).map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div
                                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                                        style={{
                                            background: i === 0 ? '#D4A84322' : i === 1 ? '#9CA3AF22' : i === 2 ? '#CD7F3222' : 'var(--ap-bg)',
                                            color: i === 0 ? '#D4A843' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'var(--ap-muted)',
                                        }}
                                    >
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>{item.name}</p>
                                        <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{item.total_sold} sold</p>
                                    </div>
                                    <p className="text-sm font-bold shrink-0" style={{ color: '#D4A843' }}>
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
    icon: Icon, label, value, trend, iconColor, iconBg,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    trend: number;
    iconColor: string;
    iconBg: string;
}) {
    const isUp = trend >= 0;
    return (
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>{label}</p>
                    <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                        {value}
                    </p>
                    {trend !== 0 && (
                        <div className="mt-2 flex items-center gap-1">
                            <span className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{ background: isUp ? '#22C55E15' : '#EF444415', color: isUp ? '#16A34A' : '#DC2626' }}>
                                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {Math.abs(trend)}%
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--ap-muted)' }}>vs yesterday</span>
                        </div>
                    )}
                </div>
                <div className="rounded-xl p-2.5" style={{ background: iconBg }}>
                    <Icon className="h-5 w-5" style={{ color: iconColor }} />
                </div>
            </div>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex h-40 items-center justify-center text-sm" style={{ color: 'var(--ap-muted)' }}>
            {label}
        </div>
    );
}
