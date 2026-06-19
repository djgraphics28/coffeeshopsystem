import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { adminOrdersIndex, adminOrdersUpdateStatus, adminOrdersVoid } from '@/lib/routes';
import { printReceipt, ThermalReceipt } from '@/components/thermal-receipt';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Ban, Coffee, CreditCard, Gift, Hash, Printer, Star, Tag, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface OrderItem {
    id: number;
    menu_item: { name: string; image_url: string | null };
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes: string | null;
    addons: { name: string; group_name: string; additional_price: number }[];
}

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    notes: string | null;
    void_reason: string | null;
    points_earned: number;
    points_redeemed: number;
    free_drink_redeemed: boolean;
    cups_awarded: number;
    table: { name: string } | null;
    customer: { id: number; name: string; email: string; phone: string | null } | null;
    promo: { code: string; name: string } | null;
    creator: { name: string } | null;
    voided_by: { name: string } | null;
    items: OrderItem[];
    payment: { method: string; amount: number; reference_no: string | null; paid_at: string } | null;
    created_at: string;
    updated_at: string;
}

interface Props {
    order: Order;
    can: { manage_orders: boolean; void_orders: boolean };
}

const STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const TERMINAL = ['completed', 'cancelled', 'voided'];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    pending:   { bg: '#FEF3C7', text: '#92400E' },
    preparing: { bg: '#DBEAFE', text: '#1E40AF' },
    ready:     { bg: '#D1FAE5', text: '#065F46' },
    completed: { bg: '#F3F4F6', text: '#6B7280' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
    voided:    { bg: '#FCE7F3', text: '#9D174D' },
};

const currency = (n: number) => `₱${Number(n).toFixed(2)}`;

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between py-1.5 text-sm">
            <span style={{ color: 'var(--ap-muted)' }}>{label}</span>
            <span className="text-right font-medium" style={{ color: 'var(--ap-input-text)' }}>{value}</span>
        </div>
    );
}

export default function OrderShow({ order, can }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const { data, setData, patch, processing } = useForm({ status: order.status });
    const [voidModal, setVoidModal] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [voiding, setVoiding] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);
    const isTerminal = TERMINAL.includes(order.status);
    const s = STATUS_STYLES[order.status] ?? { bg: '#F3F4F6', text: '#6B7280' };

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    function updateStatus(e: React.FormEvent) {
        e.preventDefault();
        patch(adminOrdersUpdateStatus(order.id));
    }

    function confirmVoid() {
        setVoiding(true);
        router.post(adminOrdersVoid(order.id), { void_reason: voidReason }, {
            onSuccess: () => { setVoidModal(false); setVoiding(false); },
            onError: () => setVoiding(false),
        });
    }

    const hasLoyalty = (order.points_earned > 0) || (order.points_redeemed > 0) || order.free_drink_redeemed || (order.cups_awarded > 0) || order.promo;

    return (
        <AdminLayout>
            <Head title={`Order ${order.order_number} — Admin`} />
            <Toaster position="top-right" />

            <div className="p-6">
                {/* Header */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Link href={adminOrdersIndex()} className="rounded-lg p-2 transition-colors hover:bg-black/5">
                        <ArrowLeft className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Order <span className="font-mono">{order.order_number}</span>
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-sm font-medium capitalize" style={s}>{order.status}</span>
                    <div className="ml-auto flex items-center gap-2">
                        {can.void_orders && !isTerminal && (
                            <button
                                onClick={() => { setVoidModal(true); setVoidReason(''); }}
                                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
                                style={{ background: '#FEE2E2', color: '#991B1B' }}
                            >
                                <Ban className="h-4 w-4" /> Void Order
                            </button>
                        )}
                        <button
                            onClick={() => receiptRef.current && printReceipt(receiptRef.current)}
                            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
                            style={{ background: '#2C1A0E', color: '#D4A843' }}
                        >
                            <Printer className="h-4 w-4" /> Print Receipt
                        </button>
                    </div>
                </div>

                <div className="hidden">
                    <div ref={receiptRef}><ThermalReceipt order={order} /></div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    {/* Left column */}
                    <div className="space-y-4 lg:col-span-2">

                        {/* Void notice */}
                        {order.status === 'voided' && (
                            <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: '#FCE7F3', border: '1px solid #FBCFE8' }}>
                                <Ban className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                                <div>
                                    <p className="font-semibold text-red-700">This order was voided</p>
                                    {order.voided_by && <p className="text-sm text-red-600">By {order.voided_by.name}</p>}
                                    {order.void_reason && <p className="mt-1 text-sm text-red-600">"{order.void_reason}"</p>}
                                </div>
                            </div>
                        )}

                        {/* Items */}
                        <div className="rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <div className="border-b px-5 py-3" style={{ borderColor: 'var(--ap-border)' }}>
                                <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    Items ({order.items.length})
                                </h2>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--ap-border)' }}>
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                                        <div
                                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                                            style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}
                                        >
                                            {item.quantity}×
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm" style={{ color: 'var(--ap-input-text)' }}>{item.menu_item.name}</p>
                                            {item.addons.length > 0 && (
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--ap-muted)' }}>
                                                    + {item.addons.map((a) => a.name).join(', ')}
                                                </p>
                                            )}
                                            {item.notes && (
                                                <p className="text-xs mt-0.5 italic" style={{ color: 'var(--ap-muted)' }}>Note: {item.notes}</p>
                                            )}
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-bold" style={{ color: '#D4A843' }}>{currency(item.subtotal)}</p>
                                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{currency(item.unit_price)} ea.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Totals */}
                            <div className="border-t px-5 py-4 space-y-1.5" style={{ borderColor: 'var(--ap-border)' }}>
                                <InfoRow label="Subtotal" value={currency(order.subtotal)} />
                                {Number(order.discount) > 0 && (
                                    <InfoRow label="Discount" value={<span className="text-red-500">-{currency(order.discount)}</span>} />
                                )}
                                <InfoRow label="Tax" value={currency(order.tax)} />
                                <div className="border-t pt-2 mt-2" style={{ borderColor: 'var(--ap-border)' }}>
                                    <div className="flex justify-between">
                                        <span className="font-bold" style={{ color: 'var(--ap-input-text)' }}>Total</span>
                                        <span className="text-lg font-bold" style={{ color: '#D4A843' }}>{currency(order.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status update */}
                        {can.manage_orders && !isTerminal && (
                            <form onSubmit={updateStatus} className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                                <h2 className="mb-3 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Update Status</h2>
                                <div className="flex gap-3">
                                    <select
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                        style={{ background: 'var(--ap-bg)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    >
                                        {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                                    </select>
                                    <button type="submit" disabled={processing} className="rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                        {processing ? 'Saving…' : 'Update'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-4">

                        {/* Order info */}
                        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <h2 className="mb-3 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Order Info</h2>
                            <div className="space-y-0.5">
                                <InfoRow label="Table" value={order.table?.name ?? '—'} />
                                <InfoRow label="Type" value={<span className="capitalize">{order.type.replace('-', ' ')}</span>} />
                                <InfoRow label="Created by" value={order.creator?.name ?? 'Customer'} />
                                {order.notes && <InfoRow label="Notes" value={<span className="italic">{order.notes}</span>} />}
                            </div>
                        </div>

                        {/* Customer */}
                        {order.customer && (
                            <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                                <div className="mb-3 flex items-center gap-2">
                                    <User className="h-4 w-4" style={{ color: '#D4A843' }} />
                                    <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Customer</h2>
                                </div>
                                <InfoRow label="Name" value={order.customer.name} />
                                <InfoRow label="Email" value={<span className="text-xs">{order.customer.email}</span>} />
                                {order.customer.phone && <InfoRow label="Phone" value={order.customer.phone} />}
                            </div>
                        )}

                        {/* Payment */}
                        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <div className="mb-3 flex items-center gap-2">
                                <CreditCard className="h-4 w-4" style={{ color: '#D4A843' }} />
                                <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Payment</h2>
                            </div>
                            {order.payment ? (
                                <div className="space-y-0.5">
                                    <InfoRow label="Method" value={<span className="capitalize">{order.payment.method}</span>} />
                                    <InfoRow label="Amount" value={currency(order.payment.amount)} />
                                    {order.payment.reference_no && <InfoRow label="Reference" value={<span className="font-mono text-xs">{order.payment.reference_no}</span>} />}
                                    <InfoRow label="Paid at" value={new Date(order.payment.paid_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })} />
                                </div>
                            ) : (
                                <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>No payment recorded</p>
                            )}
                        </div>

                        {/* Loyalty & Promos */}
                        {hasLoyalty && (
                            <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                                <div className="mb-3 flex items-center gap-2">
                                    <Star className="h-4 w-4" style={{ color: '#D4A843' }} />
                                    <h2 className="font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Loyalty & Promos</h2>
                                </div>
                                <div className="space-y-0.5">
                                    {order.promo && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                                <Tag className="h-3.5 w-3.5" /> Promo
                                            </span>
                                            <span className="rounded-full px-2 py-0.5 font-mono text-xs font-bold" style={{ background: 'rgba(212,168,67,0.12)', color: '#D4A843' }}>
                                                {order.promo.code}
                                            </span>
                                        </div>
                                    )}
                                    {order.points_earned > 0 && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                                <Star className="h-3.5 w-3.5" /> Points earned
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: '#D4A843' }}>+{order.points_earned}</span>
                                        </div>
                                    )}
                                    {order.points_redeemed > 0 && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                                <Star className="h-3.5 w-3.5" /> Points redeemed
                                            </span>
                                            <span className="text-sm font-bold text-red-500">-{order.points_redeemed}</span>
                                        </div>
                                    )}
                                    {order.cups_awarded > 0 && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                                <Coffee className="h-3.5 w-3.5" /> Cups awarded
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>+{order.cups_awarded}</span>
                                        </div>
                                    )}
                                    {order.free_drink_redeemed && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                                <Gift className="h-3.5 w-3.5" /> Free drink
                                            </span>
                                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Redeemed</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Void modal */}
            <AnimatePresence>
                {voidModal && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50" style={{ zIndex: 50 }} onClick={() => setVoidModal(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ background: 'var(--ap-card)' }}
                        >
                            <div className="mb-4 flex items-start gap-3">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                                    <Ban className="h-5 w-5 text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <h2 className="font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Void Order</h2>
                                    <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>
                                        <span className="font-mono font-bold">{order.order_number}</span> · {currency(order.total)}
                                    </p>
                                </div>
                                <button onClick={() => setVoidModal(false)}><X className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <div className="mb-4">
                                <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Reason (optional)</label>
                                <textarea
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    rows={3}
                                    placeholder="e.g. Customer changed their mind, duplicate order…"
                                    className="w-full resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                    style={{ background: 'var(--ap-bg)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setVoidModal(false)} className="flex-1 rounded-full border py-2.5 text-sm font-medium" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-muted)' }}>Cancel</button>
                                <button onClick={confirmVoid} disabled={voiding} className="flex-1 rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#EF4444', color: '#fff' }}>
                                    {voiding ? 'Voiding…' : 'Void Order'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
