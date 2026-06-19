import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    adminCustomersAdjustLoyalty,
    adminCustomersIndex,
    adminCustomersUpdate,
    adminCustomersVerifyEmail,
    adminOrdersShow,
} from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft, BadgeCheck, Calendar, ChevronDown, ChevronUp, Coffee,
    Edit2, Gift, ReceiptText, ShieldAlert, ShoppingBag, Sliders, Star, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Customer {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    email_verified_at: string | null;
    notes: string | null;
    points: number;
    cup_count: number;
    free_drinks_available: number;
    created_at: string;
}

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    points_earned: number;
    points_redeemed: number;
    free_drink_redeemed: boolean;
    cups_awarded: number;
    items_count: number;
    table_name: string | null;
    promo_code: string | null;
    payment_method: string | null;
    created_at: string;
}

interface Summary {
    total_orders: number;
    total_spent: number;
    total_discount: number;
    lifetime_points_earned: number;
    total_cups_awarded: number;
    free_drinks_redeemed: number;
    first_order_at: string | null;
    last_order_at: string | null;
}

interface Settings {
    currency: string;
    loyalty_cups_threshold: number;
    loyalty_cups_enabled: boolean;
}

interface Props {
    customer: Customer;
    orders: Order[];
    summary: Summary;
    settings: Settings;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    pending:   { bg: '#FEF3C7', text: '#92400E' },
    preparing: { bg: '#DBEAFE', text: '#1E40AF' },
    ready:     { bg: '#D1FAE5', text: '#065F46' },
    completed: { bg: '#F3F4F6', text: '#374151' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
    voided:    { bg: '#F3F4F6', text: '#9CA3AF' },
};

export default function CustomerShow({ customer, orders, summary, settings }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };
    const cur = settings.currency;

    useEffect(() => { if (flash?.success) toast.success(flash.success); }, [flash]);

    // Profile edit modal
    const [editOpen, setEditOpen] = useState(false);
    const editForm = useForm({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', notes: customer.notes ?? '', _method: 'PUT' });
    function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        editForm.post(adminCustomersUpdate(customer.id), { onSuccess: () => { setEditOpen(false); toast.success('Profile updated.'); } });
    }

    // Loyalty adjustment panel
    const [loyaltyOpen, setLoyaltyOpen] = useState(false);
    const loyaltyForm = useForm({
        points: customer.points,
        cup_count: customer.cup_count,
        free_drinks_available: customer.free_drinks_available,
        reason: '',
        _method: 'PUT',
    });
    function submitLoyalty(e: React.FormEvent) {
        e.preventDefault();
        loyaltyForm.post(adminCustomersAdjustLoyalty(customer.id), { onSuccess: () => { setLoyaltyOpen(false); toast.success('Loyalty data updated.'); } });
    }

    // Order history sort
    const [sortDesc, setSortDesc] = useState(true);
    const sortedOrders = [...orders].sort((a, b) =>
        sortDesc
            ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    function fmtDate(iso: string | null) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function fmtDateTime(iso: string) {
        return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const cupPct = settings.loyalty_cups_enabled && settings.loyalty_cups_threshold > 0
        ? Math.min((customer.cup_count / settings.loyalty_cups_threshold) * 100, 100)
        : 0;

    return (
        <AdminLayout>
            <Head title={`${customer.name} — Customer`} />
            <Toaster position="top-right" />
            <div className="p-6 space-y-6 max-w-6xl">

                {/* Back + header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href={adminCustomersIndex()} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-black/5 transition-colors" style={{ color: 'var(--ap-muted)' }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ background: '#2C1A0E' }}>
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{customer.name}</h1>
                            <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>
                                {customer.email ?? customer.phone ?? 'No contact info'} · Member since {fmtDate(customer.created_at)}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <button onClick={() => setLoyaltyOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold hover:bg-gray-100 transition-colors" style={{ color: 'var(--ap-muted)', border: '1px solid var(--ap-border)' }}>
                            <Sliders className="h-3.5 w-3.5" /> Adjust Loyalty
                        </button>
                        <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                            <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                        </button>
                    </div>
                </div>

                {/* Summary stat cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[
                        { label: 'Total Orders', value: summary.total_orders, icon: ShoppingBag, color: '#3B82F6', bg: '#EFF6FF', fmt: (v: number) => v.toString() },
                        { label: 'Total Spent', value: summary.total_spent, icon: ReceiptText, color: '#10B981', bg: '#D1FAE5', fmt: (v: number) => `${cur}${v.toFixed(2)}` },
                        { label: 'Lifetime Points Earned', value: summary.lifetime_points_earned, icon: Star, color: '#D97706', bg: '#FEF3C7', fmt: (v: number) => v.toLocaleString() },
                        { label: 'Total Cups Awarded', value: summary.total_cups_awarded, icon: Coffee, color: '#8B5CF6', bg: '#EDE9FE', fmt: (v: number) => v.toString() },
                    ].map(({ label, value, icon: Icon, color, bg, fmt }) => (
                        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>{label}</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: bg }}>
                                    <Icon className="h-4 w-4" style={{ color }} />
                                </div>
                            </div>
                            <p className="mt-2 text-xl font-bold" style={{ color: 'var(--ap-input-text)' }}>{fmt(value)}</p>
                        </div>
                    ))}
                </div>

                {/* Loyalty status row */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Points balance */}
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>Points Balance</p>
                            <Star className="h-4 w-4" style={{ color: '#D97706' }} />
                        </div>
                        <p className="text-3xl font-bold" style={{ color: '#D97706' }}>{customer.points.toLocaleString()}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                            {summary.lifetime_points_earned.toLocaleString()} earned lifetime
                        </p>
                    </div>

                    {/* Cup progress */}
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>
                                {settings.loyalty_cups_enabled ? 'Cup Progress' : 'Cup Tracking (disabled)'}
                            </p>
                            <Coffee className="h-4 w-4" style={{ color: '#2C1A0E' }} />
                        </div>
                        {settings.loyalty_cups_enabled ? (
                            <>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-bold" style={{ color: '#2C1A0E' }}>{customer.cup_count}</p>
                                    <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>/ {settings.loyalty_cups_threshold}</p>
                                </div>
                                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                    <motion.div className="h-full rounded-full" style={{ background: '#D4A843', width: `${cupPct}%` }} initial={{ width: 0 }} animate={{ width: `${cupPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                                </div>
                                <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                    {settings.loyalty_cups_threshold - customer.cup_count} more for next free drink · {summary.total_cups_awarded} total awarded
                                </p>
                            </>
                        ) : (
                            <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>Enable in Settings → Loyalty Cup Promo</p>
                        )}
                    </div>

                    {/* Free drinks */}
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>Free Drinks</p>
                            <Gift className="h-4 w-4 text-red-400" />
                        </div>
                        <p className="text-3xl font-bold" style={{ color: '#EF4444' }}>{customer.free_drinks_available}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                            available · {summary.free_drinks_redeemed} redeemed lifetime
                        </p>
                        {customer.free_drinks_available > 0 && (
                            <span className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#D1FAE5', color: '#065F46' }}>
                                🎁 Ready to redeem
                            </span>
                        )}
                    </div>
                </div>

                {/* Profile info */}
                {(customer.phone || customer.email || customer.notes) && (
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>Profile</p>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 text-sm">
                            {customer.email && (
                                <div>
                                    <p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Email</p>
                                    <p style={{ color: 'var(--ap-input-text)' }}>{customer.email}</p>
                                    <div className="mt-1">
                                        {customer.email_verified_at ? (
                                            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                                                <BadgeCheck className="h-3.5 w-3.5" /> Verified
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#D97706' }}>
                                                    <ShieldAlert className="h-3.5 w-3.5" /> Not verified
                                                </span>
                                                <button
                                                    onClick={() => { if (confirm(`Manually verify ${customer.name}'s email?`)) router.post(adminCustomersVerifyEmail(customer.id)); }}
                                                    className="rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors hover:opacity-80"
                                                    style={{ background: '#2C1A0E', color: '#D4A843' }}
                                                >
                                                    Verify now
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {customer.phone && <div><p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Phone</p><p style={{ color: 'var(--ap-input-text)' }}>{customer.phone}</p></div>}
                            {customer.notes && <div><p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Notes</p><p style={{ color: 'var(--ap-input-text)' }}>{customer.notes}</p></div>}
                        </div>
                    </div>
                )}

                {/* Order history */}
                <div className="rounded-2xl bg-white shadow-sm overflow-hidden" style={{ border: '1px solid var(--ap-border)' }}>
                    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--ap-border)' }}>
                        <div>
                            <p className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Order History</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--ap-muted)' }}>{orders.length} orders · {cur}{summary.total_discount.toFixed(2)} total discounts</p>
                        </div>
                        <button onClick={() => setSortDesc(!sortDesc)} className="flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1.5 hover:bg-gray-100" style={{ color: 'var(--ap-muted)' }}>
                            <Calendar className="h-3.5 w-3.5" />
                            {sortDesc ? 'Newest first' : 'Oldest first'}
                            {sortDesc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                                <tr>
                                    {['Order #', 'Date', 'Where', 'Items', 'Subtotal', 'Discount', 'Total', 'Points', 'Cups', 'Status', 'Payment', ''].map((h) => (
                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedOrders.length === 0 && (
                                    <tr><td colSpan={12} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>No orders yet.</td></tr>
                                )}
                                {sortedOrders.map((order) => {
                                    const s = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending;
                                    return (
                                        <tr key={order.id} className="border-t hover:bg-gray-50/50 transition-colors" style={{ borderColor: 'var(--ap-border)' }}>
                                            <td className="px-4 py-3">
                                                <Link href={adminOrdersShow(order.id)} className="font-mono text-xs font-semibold hover:underline" style={{ color: '#2C1A0E' }}>
                                                    {order.order_number}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--ap-muted)' }}>
                                                {fmtDateTime(order.created_at)}
                                            </td>
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                                {order.table_name ?? order.type}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-center">
                                                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#F3F4F6', color: '#374151' }}>{order.items_count}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>{cur}{order.subtotal.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-xs">
                                                {order.discount > 0 ? (
                                                    <div>
                                                        <span className="font-semibold" style={{ color: '#059669' }}>-{cur}{order.discount.toFixed(2)}</span>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {order.promo_code && <span className="text-[9px] rounded px-1 py-px font-mono" style={{ background: '#FEF3C7', color: '#92400E' }}>{order.promo_code}</span>}
                                                            {order.points_redeemed > 0 && <span className="text-[9px] rounded px-1 py-px" style={{ background: '#EDE9FE', color: '#5B21B6' }}>⭐ pts</span>}
                                                            {order.free_drink_redeemed && <span className="text-[9px] rounded px-1 py-px" style={{ background: '#D1FAE5', color: '#065F46' }}>🎁 free</span>}
                                                        </div>
                                                    </div>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--ap-input-text)' }}>{cur}{order.total.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-xs">
                                                {order.points_earned > 0
                                                    ? <span style={{ color: '#D97706' }}>+{order.points_earned}</span>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-center">
                                                {order.cups_awarded > 0
                                                    ? <span style={{ color: '#2C1A0E' }}>☕{order.cups_awarded}</span>
                                                    : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] capitalize" style={{ color: 'var(--ap-muted)' }}>
                                                {order.payment_method ?? <span className="text-gray-300">unpaid</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link href={adminOrdersShow(order.id)} className="text-[10px] font-medium rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors" style={{ color: 'var(--ap-muted)' }}>
                                                    View →
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit profile modal */}
            <AnimatePresence>
                {editOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setEditOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60 }}>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Edit Profile</h2>
                                <button onClick={() => setEditOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submitEdit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Full Name *</label>
                                    <input value={editForm.data.name} onChange={(e) => editForm.setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {editForm.errors.name && <p className="mt-1 text-xs text-red-500">{editForm.errors.name}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Phone</label>
                                    <input value={editForm.data.phone} onChange={(e) => editForm.setData('phone', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {editForm.errors.phone && <p className="mt-1 text-xs text-red-500">{editForm.errors.phone}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Email</label>
                                    <input type="email" value={editForm.data.email} onChange={(e) => editForm.setData('email', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {editForm.errors.email && <p className="mt-1 text-xs text-red-500">{editForm.errors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Notes</label>
                                    <textarea value={editForm.data.notes} onChange={(e) => editForm.setData('notes', e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                </div>
                                <button type="submit" disabled={editForm.processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {editForm.processing ? 'Saving...' : 'Save Changes'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Loyalty adjustment panel (slide in from right) */}
            <AnimatePresence>
                {loyaltyOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setLoyaltyOpen(false)} />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl"
                            style={{ zIndex: 60 }}
                        >
                            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#2C1A0E' }}>
                                <div>
                                    <p className="font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Adjust Loyalty</p>
                                    <p className="text-xs" style={{ color: '#D4A843' }}>{customer.name}</p>
                                </div>
                                <button onClick={() => setLoyaltyOpen(false)}><X className="h-5 w-5 text-white" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5">
                                <p className="mb-5 text-xs rounded-xl p-3" style={{ background: '#FEF3C7', color: '#92400E' }}>
                                    ⚠️ These are absolute values — set the exact number you want. Changes take effect immediately.
                                </p>
                                <form onSubmit={submitLoyalty} className="space-y-5">
                                    {/* Points */}
                                    <div>
                                        <label className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--ap-input-text)' }}>
                                            <Star className="h-4 w-4" style={{ color: '#D97706' }} /> Points Balance
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => loyaltyForm.setData('points', Math.max(0, loyaltyForm.data.points - 10))} className="flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold hover:bg-gray-50" style={{ borderColor: 'var(--ap-border)' }}>−</button>
                                            <input
                                                type="number"
                                                min="0"
                                                value={loyaltyForm.data.points}
                                                onChange={(e) => loyaltyForm.setData('points', Math.max(0, parseInt(e.target.value) || 0))}
                                                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold focus:border-yellow-400 focus:outline-none"
                                                style={{ color: '#D97706' }}
                                            />
                                            <button type="button" onClick={() => loyaltyForm.setData('points', loyaltyForm.data.points + 10)} className="flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold hover:bg-gray-50" style={{ borderColor: 'var(--ap-border)' }}>+</button>
                                        </div>
                                        <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>Current: {customer.points.toLocaleString()} pts</p>
                                    </div>

                                    {/* Cup count */}
                                    {settings.loyalty_cups_enabled && (
                                        <div>
                                            <label className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--ap-input-text)' }}>
                                                <Coffee className="h-4 w-4" style={{ color: '#2C1A0E' }} /> Cup Count
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => loyaltyForm.setData('cup_count', Math.max(0, loyaltyForm.data.cup_count - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold hover:bg-gray-50" style={{ borderColor: 'var(--ap-border)' }}>−</button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={settings.loyalty_cups_threshold - 1}
                                                    value={loyaltyForm.data.cup_count}
                                                    onChange={(e) => loyaltyForm.setData('cup_count', Math.max(0, parseInt(e.target.value) || 0))}
                                                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold focus:border-yellow-400 focus:outline-none"
                                                    style={{ color: '#2C1A0E' }}
                                                />
                                                <button type="button" onClick={() => loyaltyForm.setData('cup_count', Math.min(loyaltyForm.data.cup_count + 1, settings.loyalty_cups_threshold - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold hover:bg-gray-50" style={{ borderColor: 'var(--ap-border)' }}>+</button>
                                            </div>
                                            <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                                Current: {customer.cup_count} / {settings.loyalty_cups_threshold} · max {settings.loyalty_cups_threshold - 1} before auto-award
                                            </p>
                                        </div>
                                    )}

                                    {/* Free drinks */}
                                    <div>
                                        <label className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--ap-input-text)' }}>
                                            <Gift className="h-4 w-4 text-red-400" /> Free Drinks Available
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => loyaltyForm.setData('free_drinks_available', Math.max(0, loyaltyForm.data.free_drinks_available - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold hover:bg-gray-50" style={{ borderColor: 'var(--ap-border)' }}>−</button>
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={loyaltyForm.data.free_drinks_available}
                                                onChange={(e) => loyaltyForm.setData('free_drinks_available', Math.max(0, parseInt(e.target.value) || 0))}
                                                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-center text-lg font-bold focus:border-yellow-400 focus:outline-none"
                                                style={{ color: '#EF4444' }}
                                            />
                                            <button type="button" onClick={() => loyaltyForm.setData('free_drinks_available', loyaltyForm.data.free_drinks_available + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold hover:bg-gray-50" style={{ borderColor: 'var(--ap-border)' }}>+</button>
                                        </div>
                                        <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>Current: {customer.free_drinks_available}</p>
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Reason <span className="text-gray-400">(optional)</span></label>
                                        <input
                                            value={loyaltyForm.data.reason}
                                            onChange={(e) => loyaltyForm.setData('reason', e.target.value)}
                                            placeholder="Manual correction, compensation, etc."
                                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                        />
                                    </div>

                                    <button type="submit" disabled={loyaltyForm.processing} className="w-full rounded-full py-3 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                        {loyaltyForm.processing ? 'Saving...' : 'Apply Changes'}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
