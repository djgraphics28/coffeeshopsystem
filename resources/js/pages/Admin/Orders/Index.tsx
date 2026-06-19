import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { adminOrdersIndex, adminOrdersShow, adminOrdersVoid } from '@/lib/routes';
import { printReceipt, ThermalReceipt, type ReceiptOrder } from '@/components/thermal-receipt';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Ban, ChevronLeft, ChevronRight, Eye,
    PackageCheck, Printer, Search, ShoppingBag, TrendingUp, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    points_earned: number;
    free_drink_redeemed: boolean;
    table: { name: string } | null;
    customer: { id: number; name: string; email: string } | null;
    promo: { code: string } | null;
    items: { id: number; menu_item: { name: string }; quantity: number; subtotal: number; addons: { name: string }[] }[];
    payment: { method: string; amount: number; reference_no: string | null } | null;
    created_at: string;
}

interface Paginated<T> {
    data: T[];
    links: { first: string; last: string; prev: string | null; next: string | null };
    meta: {
        current_page: number;
        last_page: number;
        total: number;
        from: number;
        to: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
}

interface Stats {
    today_count: number;
    today_revenue: number;
    pending: number;
    active: number;
}

interface Props {
    orders: Paginated<Order>;
    filters: { search?: string; status?: string; date_from?: string; date_to?: string; type?: string; payment?: string };
    stats: Stats;
    can: { manage_orders: boolean; void_orders: boolean };
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    pending:   { bg: '#FEF3C7', text: '#92400E' },
    preparing: { bg: '#DBEAFE', text: '#1E40AF' },
    ready:     { bg: '#D1FAE5', text: '#065F46' },
    completed: { bg: '#F3F4F6', text: '#6B7280' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
    voided:    { bg: '#FCE7F3', text: '#9D174D' },
};

const TERMINAL = ['completed', 'cancelled', 'voided'];

const currency = (n: number) => `₱${Number(n).toFixed(2)}`;

export default function OrdersIndex({ orders, filters, stats, can }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const { data, setData } = useForm({ ...filters });
    const [printingOrder, setPrintingOrder] = useState<ReceiptOrder | null>(null);
    const [voidModal, setVoidModal] = useState<Order | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voiding, setVoiding] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    function applyFilters(e: React.FormEvent) {
        e.preventDefault();
        router.get(adminOrdersIndex(), data as Record<string, string>, { preserveState: true, preserveScroll: true });
    }

    function clearFilters() {
        router.get(adminOrdersIndex());
    }

    function openVoidModal(order: Order) {
        setVoidModal(order);
        setVoidReason('');
    }

    function confirmVoid() {
        if (!voidModal) return;
        setVoiding(true);
        router.post(adminOrdersVoid(voidModal.id), { void_reason: voidReason }, {
            preserveScroll: true,
            onSuccess: () => { setVoidModal(null); setVoiding(false); },
            onError: () => setVoiding(false),
        });
    }

    const statCards = [
        { label: "Today's Orders", value: stats.today_count, icon: ShoppingBag, color: '#2C1A0E' },
        { label: "Today's Revenue", value: currency(stats.today_revenue), icon: TrendingUp, color: '#15803D' },
        { label: 'Pending', value: stats.pending, icon: PackageCheck, color: '#B45309' },
        { label: 'Active', value: stats.active, icon: PackageCheck, color: '#1E40AF' },
    ];

    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <AdminLayout>
            <Head title="Orders — Admin" />
            <Toaster position="top-right" />

            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Orders</h1>
                        <p className="mt-1 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {orders.meta.total} total · page {orders.meta.current_page} of {orders.meta.last_page}
                        </p>
                    </div>
                </div>

                {/* Stat cards */}
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statCards.map((c) => (
                        <div key={c.label} className="rounded-2xl p-4 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${c.color}18` }}>
                                <c.icon className="h-4 w-4" style={{ color: c.color }} />
                            </div>
                            <p className="text-xl font-bold" style={{ color: 'var(--ap-input-text)' }}>{c.value}</p>
                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{c.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }} />
                        <input
                            value={data.search ?? ''}
                            onChange={(e) => setData('search', e.target.value)}
                            placeholder="Order #, table, customer…"
                            className="rounded-xl border py-1.5 pl-8 pr-3 text-sm focus:outline-none"
                            style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)', width: 220 }}
                        />
                    </div>
                    {(['status', 'type', 'payment'] as const).map((field) => (
                        <select
                            key={field}
                            value={(data as Record<string, string>)[field] ?? ''}
                            onChange={(e) => setData(field, e.target.value)}
                            className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none"
                            style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                        >
                            {field === 'status' && <>
                                <option value="">All statuses</option>
                                {['pending','preparing','ready','completed','cancelled','voided'].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                            </>}
                            {field === 'type' && <>
                                <option value="">All types</option>
                                {['dine-in','takeout','walkin'].map((t) => <option key={t} value={t}>{t.replace('-',' ')}</option>)}
                            </>}
                            {field === 'payment' && <>
                                <option value="">All payments</option>
                                <option value="paid">Paid</option>
                                <option value="unpaid">Unpaid</option>
                            </>}
                        </select>
                    ))}
                    <input type="date" value={data.date_from ?? ''} onChange={(e) => setData('date_from', e.target.value)}
                        className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none"
                        style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }} />
                    <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>to</span>
                    <input type="date" value={data.date_to ?? ''} onChange={(e) => setData('date_to', e.target.value)}
                        className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none"
                        style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }} />
                    <button type="submit" className="rounded-xl px-4 py-1.5 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>Filter</button>
                    {hasFilters && (
                        <button type="button" onClick={clearFilters} className="rounded-xl border px-4 py-1.5 text-sm" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-muted)', background: 'var(--ap-card)' }}>
                            Clear
                        </button>
                    )}
                </form>

                {/* Table */}
                <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>
                                {['Order #', 'Customer / Table', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment', 'Loyalty', 'Status', 'Date', ''].map((h) => (
                                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {orders.data.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>
                                        No orders found
                                    </td>
                                </tr>
                            ) : orders.data.map((order) => {
                                const s = STATUS_STYLES[order.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
                                const isTerminal = TERMINAL.includes(order.status);
                                return (
                                    <tr
                                        key={order.id}
                                        className="border-t transition-colors hover:bg-black/[0.015]"
                                        style={{ borderColor: 'var(--ap-border)', opacity: order.status === 'voided' ? 0.6 : 1 }}
                                    >
                                        <td className="px-3 py-3">
                                            <span className="font-mono text-xs font-bold" style={{ color: 'var(--ap-input-text)' }}>{order.order_number}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            {order.customer ? (
                                                <div>
                                                    <p className="font-medium text-xs" style={{ color: 'var(--ap-input-text)' }}>{order.customer.name}</p>
                                                    <p className="text-[10px]" style={{ color: 'var(--ap-muted)' }}>{order.table?.name ?? order.type}</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{order.table?.name ?? 'Walk-in'}</p>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div>
                                                <p className="text-xs font-medium" style={{ color: 'var(--ap-input-text)' }}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                                                <p className="max-w-[120px] truncate text-[10px]" style={{ color: 'var(--ap-muted)' }}>
                                                    {order.items.map((i) => `${i.quantity}× ${i.menu_item.name}`).join(', ')}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>{currency(order.subtotal)}</td>
                                        <td className="px-3 py-3 text-xs">
                                            {Number(order.discount) > 0 ? (
                                                <span className="text-red-500">-{currency(order.discount)}</span>
                                            ) : (
                                                <span style={{ color: 'var(--ap-muted)' }}>—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-sm font-bold" style={{ color: '#D4A843' }}>{currency(order.total)}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            {order.payment ? (
                                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 capitalize">
                                                    {order.payment.method}
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">Unpaid</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex flex-wrap gap-0.5">
                                                {order.promo && (
                                                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-mono" style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}>
                                                        {order.promo.code}
                                                    </span>
                                                )}
                                                {Number(order.points_earned) > 0 && (
                                                    <span className="text-[10px]" style={{ color: '#D4A843' }}>⭐{order.points_earned}</span>
                                                )}
                                                {order.free_drink_redeemed && (
                                                    <span className="text-[10px]">🎁</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize" style={s}>{order.status}</span>
                                        </td>
                                        <td className="px-3 py-3 text-[10px]" style={{ color: 'var(--ap-muted)' }}>
                                            {new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1">
                                                <Link
                                                    href={adminOrdersShow(order.id)}
                                                    className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                                                    title="View order"
                                                >
                                                    <Eye className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                                </Link>
                                                {can.void_orders && !isTerminal && (
                                                    <button
                                                        onClick={() => openVoidModal(order)}
                                                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                                                        title="Void order"
                                                    >
                                                        <Ban className="h-3.5 w-3.5 text-red-400" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setPrintingOrder(order)}
                                                    className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                                                    title="Print receipt"
                                                >
                                                    <Printer className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {orders.meta.last_page > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>
                            Showing {orders.meta.from}–{orders.meta.to} of {orders.meta.total}
                        </p>
                        <div className="flex gap-1">
                            {orders.meta.links.map((link, i) => {
                                const isPrev = link.label.includes('Previous');
                                const isNext = link.label.includes('Next');
                                return (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url)}
                                        className="flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs transition-colors disabled:opacity-40"
                                        style={link.active
                                            ? { background: '#D4A843', color: '#2C1A0E', fontWeight: 700 }
                                            : { color: 'var(--ap-muted)', background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }
                                        }
                                    >
                                        {isPrev ? <ChevronLeft className="h-3.5 w-3.5" /> : isNext ? <ChevronRight className="h-3.5 w-3.5" /> : <span dangerouslySetInnerHTML={{ __html: link.label }} />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Void modal */}
            <AnimatePresence>
                {voidModal && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50" style={{ zIndex: 50 }} onClick={() => setVoidModal(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ background: 'var(--ap-card)' }}
                        >
                            <div className="mb-4 flex items-start gap-3">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                                    <Ban className="h-5 w-5 text-red-500" />
                                </div>
                                <div>
                                    <h2 className="font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Void Order</h2>
                                    <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>
                                        <span className="font-mono font-bold">{voidModal.order_number}</span> · {currency(voidModal.total)}
                                    </p>
                                </div>
                                <button onClick={() => setVoidModal(null)} className="ml-auto"><X className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Reason (optional)</label>
                                <textarea
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Customer changed their mind, duplicate order…"
                                    className="w-full resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                    style={{ background: 'var(--ap-bg)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setVoidModal(null)} className="flex-1 rounded-full border py-2.5 text-sm font-medium" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-muted)' }}>
                                    Cancel
                                </button>
                                <button onClick={confirmVoid} disabled={voiding} className="flex-1 rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#EF4444', color: '#fff' }}>
                                    {voiding ? 'Voiding…' : 'Void Order'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Receipt modal */}
            {printingOrder && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setPrintingOrder(null)} />
                    <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'var(--ap-card)' }}>
                        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--ap-border)' }}>
                            <span className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>Receipt — {printingOrder.order_number}</span>
                            <button onClick={() => setPrintingOrder(null)}><X className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                        </div>
                        <div className="max-h-96 overflow-y-auto p-4" style={{ background: 'var(--ap-bg)' }}>
                            <div ref={receiptRef}><ThermalReceipt order={printingOrder} /></div>
                        </div>
                        <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--ap-border)' }}>
                            <button onClick={() => setPrintingOrder(null)} className="flex-1 rounded-full border py-2.5 text-sm font-medium" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-muted)' }}>Close</button>
                            <button onClick={() => receiptRef.current && printReceipt(receiptRef.current)} className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                                <Printer className="h-4 w-4" /> Print
                            </button>
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
}
