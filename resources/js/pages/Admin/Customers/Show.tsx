import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import type { VariantProps } from 'class-variance-authority';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft, BadgeCheck, Calendar, ChevronDown, ChevronUp, Coffee,
    Edit2, Gift, ReceiptText, ShieldAlert, ShoppingBag, Sliders, Star, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Badge  } from '@/components/ui/badge';
import type {badgeVariants} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import {
    adminCustomersAdjustLoyalty,
    adminCustomersIndex,
    adminCustomersUpdate,
    adminCustomersVerifyEmail,
    adminOrdersShow,
} from '@/lib/routes';

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

const STATUS_VARIANT: Record<string, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
    pending: 'warning',
    preparing: 'info',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'error',
    voided: 'neutral',
};

export default function CustomerShow({ customer, orders, summary, settings }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };
    const cur = settings.currency;

    useEffect(() => {
 if (flash?.success) {
toast.success(flash.success);
} 
}, [flash]);

    // Profile edit modal
    const [editOpen, setEditOpen] = useState(false);
    const editForm = useForm({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', notes: customer.notes ?? '', _method: 'PUT' });
    function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        editForm.post(adminCustomersUpdate(customer.id), { onSuccess: () => {
 setEditOpen(false); toast.success('Profile updated.'); 
} });
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
        loyaltyForm.post(adminCustomersAdjustLoyalty(customer.id), { onSuccess: () => {
 setLoyaltyOpen(false); toast.success('Loyalty data updated.'); 
} });
    }

    // Order history sort
    const [sortDesc, setSortDesc] = useState(true);
    const sortedOrders = [...orders].sort((a, b) =>
        sortDesc
            ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    function fmtDate(iso: string | null) {
        if (!iso) {
return '—';
}

        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function fmtDateTime(iso: string) {
        return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const cupPct = settings.loyalty_cups_enabled && settings.loyalty_cups_threshold > 0
        ? Math.min((customer.cup_count / settings.loyalty_cups_threshold) * 100, 100)
        : 0;

    const summaryCards = [
        { label: 'Total Orders', value: summary.total_orders, icon: ShoppingBag, tone: 'brand', fmt: (v: number) => v.toString() },
        { label: 'Total Spent', value: summary.total_spent, icon: ReceiptText, tone: 'success', fmt: (v: number) => `${cur}${v.toFixed(2)}` },
        { label: 'Lifetime Points Earned', value: summary.lifetime_points_earned, icon: Star, tone: 'warning', fmt: (v: number) => v.toLocaleString() },
        { label: 'Total Cups Awarded', value: summary.total_cups_awarded, icon: Coffee, tone: 'info', fmt: (v: number) => v.toString() },
    ];
    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        warning: 'bg-warning/10 text-warning',
        success: 'bg-success/10 text-success',
        error: 'bg-error/10 text-error',
        info: 'bg-info/10 text-info',
    };

    return (
        <AdminLayout>
            <Head title={`${customer.name} — Customer`} />
            <Toaster position="top-right" />
            <div className="max-w-6xl space-y-6">

                {/* Back + header */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link href={adminCustomersIndex()} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                            {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{customer.name}</h1>
                            <p className="text-sm text-muted-foreground">
                                {customer.email ?? customer.phone ?? 'No contact info'} · Member since {fmtDate(customer.created_at)}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={() => setLoyaltyOpen(true)}>
                            <Sliders className="h-3.5 w-3.5" /> Adjust Loyalty
                        </Button>
                        <Button onClick={() => setEditOpen(true)}>
                            <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                        </Button>
                    </div>
                </div>

                {/* Summary stat cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {summaryCards.map(({ label, value, icon: Icon, tone, fmt }) => (
                        <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                            <p className="mt-2 text-xl font-bold text-foreground">{fmt(value)}</p>
                        </div>
                    ))}
                </div>

                {/* Loyalty status row */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Points balance */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">Points Balance</p>
                            <Star className="h-4 w-4 text-warning" />
                        </div>
                        <p className="text-3xl font-bold text-warning">{customer.points.toLocaleString()}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {summary.lifetime_points_earned.toLocaleString()} earned lifetime
                        </p>
                    </div>

                    {/* Cup progress */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">
                                {settings.loyalty_cups_enabled ? 'Cup Progress' : 'Cup Tracking (disabled)'}
                            </p>
                            <Coffee className="h-4 w-4 text-primary" />
                        </div>
                        {settings.loyalty_cups_enabled ? (
                            <>
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-bold text-foreground">{customer.cup_count}</p>
                                    <p className="text-sm text-muted-foreground">/ {settings.loyalty_cups_threshold}</p>
                                </div>
                                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${cupPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {settings.loyalty_cups_threshold - customer.cup_count} more for next free drink · {summary.total_cups_awarded} total awarded
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">Enable in Settings → Loyalty Cup Promo</p>
                        )}
                    </div>

                    {/* Free drinks */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">Free Drinks</p>
                            <Gift className="h-4 w-4 text-error" />
                        </div>
                        <p className="text-3xl font-bold text-error">{customer.free_drinks_available}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            available · {summary.free_drinks_redeemed} redeemed lifetime
                        </p>
                        {customer.free_drinks_available > 0 && (
                            <Badge variant="success" className="mt-2">🎁 Ready to redeem</Badge>
                        )}
                    </div>
                </div>

                {/* Profile info */}
                {(customer.phone || customer.email || customer.notes) && (
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <p className="mb-3 text-sm font-semibold text-foreground">Profile</p>
                        <div className="grid grid-cols-1 gap-3 text-sm lg:grid-cols-3">
                            {customer.email && (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                                    <p className="text-foreground">{customer.email}</p>
                                    <div className="mt-1">
                                        {customer.email_verified_at ? (
                                            <span className="flex items-center gap-1 text-xs font-medium text-success">
                                                <BadgeCheck className="h-3.5 w-3.5" /> Verified
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1 text-xs font-medium text-warning">
                                                    <ShieldAlert className="h-3.5 w-3.5" /> Not verified
                                                </span>
                                                <button
                                                    onClick={() => {
 if (confirm(`Manually verify ${customer.name}'s email?`)) {
router.post(adminCustomersVerifyEmail(customer.id));
} 
}}
                                                    className="rounded-lg bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                                >
                                                    Verify now
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {customer.phone && <div><p className="text-xs font-medium text-muted-foreground">Phone</p><p className="text-foreground">{customer.phone}</p></div>}
                            {customer.notes && <div><p className="text-xs font-medium text-muted-foreground">Notes</p><p className="text-foreground">{customer.notes}</p></div>}
                        </div>
                    </div>
                )}

                {/* Order history */}
                <TableCard>
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                        <div>
                            <p className="font-semibold text-foreground">Order History</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{orders.length} orders · {cur}{summary.total_discount.toFixed(2)} total discounts</p>
                        </div>
                        <button onClick={() => setSortDesc(!sortDesc)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                            <Calendar className="h-3.5 w-3.5" />
                            {sortDesc ? 'Newest first' : 'Oldest first'}
                            {sortDesc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </button>
                    </div>
                    <TableScroll>
                        <Table>
                            <TableHead>
                                <tr>
                                    {['Order #', 'Date', 'Where', 'Items', 'Subtotal', 'Discount', 'Total', 'Points', 'Cups', 'Status', 'Payment', ''].map((h) => (
                                        <TableHeadCell key={h}>{h}</TableHeadCell>
                                    ))}
                                </tr>
                            </TableHead>
                            <TableBody>
                                {sortedOrders.length === 0 && <TableEmpty colSpan={12}>No orders yet.</TableEmpty>}
                                {sortedOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            <Link href={adminOrdersShow(order.id)} className="font-mono text-xs font-semibold text-primary hover:underline">
                                                {order.order_number}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                            {fmtDateTime(order.created_at)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {order.table_name ?? order.type}
                                        </TableCell>
                                        <TableCell className="text-center text-xs">
                                            <Badge variant="neutral">{order.items_count}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{cur}{order.subtotal.toFixed(2)}</TableCell>
                                        <TableCell className="text-xs">
                                            {order.discount > 0 ? (
                                                <div>
                                                    <span className="font-semibold text-success">-{cur}{order.discount.toFixed(2)}</span>
                                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                                        {order.promo_code && <span className="rounded bg-warning/10 px-1 py-px font-mono text-[9px] text-warning">{order.promo_code}</span>}
                                                        {order.points_redeemed > 0 && <span className="rounded bg-info/10 px-1 py-px text-[9px] text-info">⭐ pts</span>}
                                                        {order.free_drink_redeemed && <span className="rounded bg-success/10 px-1 py-px text-[9px] text-success">🎁 free</span>}
                                                    </div>
                                                </div>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold">{cur}{order.total.toFixed(2)}</TableCell>
                                        <TableCell className="text-xs">
                                            {order.points_earned > 0
                                                ? <span className="text-warning">+{order.points_earned}</span>
                                                : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-center text-xs">
                                            {order.cups_awarded > 0
                                                ? <span className="text-foreground">☕{order.cups_awarded}</span>
                                                : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'} className="capitalize">
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] capitalize text-muted-foreground">
                                            {order.payment_method ?? <span className="text-muted-foreground">unpaid</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Link href={adminOrdersShow(order.id)} className="rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted">
                                                View →
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableScroll>
                </TableCard>
            </div>

            {/* Edit profile modal */}
            <CrudModal
                open={editOpen}
                onOpenChange={setEditOpen}
                title="Edit Profile"
                footer={
                    <Button type="submit" form="customer-edit-form" disabled={editForm.processing} className="w-full sm:w-auto">
                        {editForm.processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
            >
                <form id="customer-edit-form" onSubmit={submitEdit} className="space-y-4">
                    <FormField label="Full Name" required error={editForm.errors.name}>
                        <input value={editForm.data.name} onChange={(e) => editForm.setData('name', e.target.value)} className={adminFieldClass(!!editForm.errors.name)} />
                    </FormField>
                    <FormField label="Phone" error={editForm.errors.phone}>
                        <input value={editForm.data.phone} onChange={(e) => editForm.setData('phone', e.target.value)} className={adminFieldClass(!!editForm.errors.phone)} />
                    </FormField>
                    <FormField label="Email" error={editForm.errors.email}>
                        <input type="email" value={editForm.data.email} onChange={(e) => editForm.setData('email', e.target.value)} className={adminFieldClass(!!editForm.errors.email)} />
                    </FormField>
                    <FormField label="Notes">
                        <textarea value={editForm.data.notes} onChange={(e) => editForm.setData('notes', e.target.value)} rows={2} className={adminFieldClass() + ' resize-none'} />
                    </FormField>
                </form>
            </CrudModal>

            {/* Loyalty adjustment panel (slide in from right) */}
            <AnimatePresence>
                {loyaltyOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/40" onClick={() => setLoyaltyOpen(false)} />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="admin-panel fixed inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col bg-card shadow-2xl"
                        >
                            <div className="flex items-center justify-between bg-primary px-5 py-4">
                                <div>
                                    <p className="font-bold text-primary-foreground">Adjust Loyalty</p>
                                    <p className="text-xs text-primary-foreground/70">{customer.name}</p>
                                </div>
                                <button onClick={() => setLoyaltyOpen(false)}><X className="h-5 w-5 text-primary-foreground" /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5">
                                <p className="mb-5 rounded-xl bg-warning/10 p-3 text-xs text-warning">
                                    ⚠️ These are absolute values — set the exact number you want. Changes take effect immediately.
                                </p>
                                <form onSubmit={submitLoyalty} className="space-y-5">
                                    {/* Points */}
                                    <div>
                                        <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                            <Star className="h-4 w-4 text-warning" /> Points Balance
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => loyaltyForm.setData('points', Math.max(0, loyaltyForm.data.points - 10))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg font-bold text-foreground hover:bg-muted">−</button>
                                            <input
                                                type="number"
                                                min="0"
                                                value={loyaltyForm.data.points}
                                                onChange={(e) => loyaltyForm.setData('points', Math.max(0, parseInt(e.target.value) || 0))}
                                                className={adminFieldClass() + ' flex-1 text-center text-lg font-bold text-warning'}
                                            />
                                            <button type="button" onClick={() => loyaltyForm.setData('points', loyaltyForm.data.points + 10)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg font-bold text-foreground hover:bg-muted">+</button>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">Current: {customer.points.toLocaleString()} pts</p>
                                    </div>

                                    {/* Cup count */}
                                    {settings.loyalty_cups_enabled && (
                                        <div>
                                            <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                                <Coffee className="h-4 w-4 text-primary" /> Cup Count
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <button type="button" onClick={() => loyaltyForm.setData('cup_count', Math.max(0, loyaltyForm.data.cup_count - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg font-bold text-foreground hover:bg-muted">−</button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={settings.loyalty_cups_threshold - 1}
                                                    value={loyaltyForm.data.cup_count}
                                                    onChange={(e) => loyaltyForm.setData('cup_count', Math.max(0, parseInt(e.target.value) || 0))}
                                                    className={adminFieldClass() + ' flex-1 text-center text-lg font-bold text-foreground'}
                                                />
                                                <button type="button" onClick={() => loyaltyForm.setData('cup_count', Math.min(loyaltyForm.data.cup_count + 1, settings.loyalty_cups_threshold - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg font-bold text-foreground hover:bg-muted">+</button>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Current: {customer.cup_count} / {settings.loyalty_cups_threshold} · max {settings.loyalty_cups_threshold - 1} before auto-award
                                            </p>
                                        </div>
                                    )}

                                    {/* Free drinks */}
                                    <div>
                                        <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                            <Gift className="h-4 w-4 text-error" /> Free Drinks Available
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => loyaltyForm.setData('free_drinks_available', Math.max(0, loyaltyForm.data.free_drinks_available - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg font-bold text-foreground hover:bg-muted">−</button>
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={loyaltyForm.data.free_drinks_available}
                                                onChange={(e) => loyaltyForm.setData('free_drinks_available', Math.max(0, parseInt(e.target.value) || 0))}
                                                className={adminFieldClass() + ' flex-1 text-center text-lg font-bold text-error'}
                                            />
                                            <button type="button" onClick={() => loyaltyForm.setData('free_drinks_available', loyaltyForm.data.free_drinks_available + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-lg font-bold text-foreground hover:bg-muted">+</button>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">Current: {customer.free_drinks_available}</p>
                                    </div>

                                    {/* Reason */}
                                    <FormField label={<>Reason <span className="text-muted-foreground">(optional)</span></>}>
                                        <input
                                            value={loyaltyForm.data.reason}
                                            onChange={(e) => loyaltyForm.setData('reason', e.target.value)}
                                            placeholder="Manual correction, compensation, etc."
                                            className={adminFieldClass()}
                                        />
                                    </FormField>

                                    <Button type="submit" disabled={loyaltyForm.processing} className="w-full py-3">
                                        {loyaltyForm.processing ? 'Saving...' : 'Apply Changes'}
                                    </Button>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
