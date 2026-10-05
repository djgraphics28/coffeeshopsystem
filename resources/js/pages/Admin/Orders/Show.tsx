import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import type { VariantProps } from 'class-variance-authority';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BadgeCheck, Ban, Bike, Coffee, CreditCard, Gift, MapPin, Printer, Star, Tag, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { adminFieldClass } from '@/components/admin/form-field';
import { printReceipt, ThermalReceipt } from '@/components/thermal-receipt';
import { Badge  } from '@/components/ui/badge';
import type {badgeVariants} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminOrdersAssignDeliveryMan, adminOrdersIndex, adminOrdersMarkPaid, adminOrdersUpdateStatus, adminOrdersVoid } from '@/lib/routes';

interface OrderItem {
    id: number;
    menu_item: { name: string; image_url: string | null };
    variation: { id: number; name: string; price: number } | null;
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
    delivery_address: string | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
    payment_method: string | null;
    payment_proof_url: string | null;
    delivery_man: { id: number; name: string; phone: string | null; vehicle: string | null } | null;
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

interface DeliveryManOption {
    id: number;
    name: string;
    phone: string | null;
    vehicle: string | null;
}

interface Props {
    order: Order;
    delivery_men: DeliveryManOption[];
    can: { manage_orders: boolean; void_orders: boolean };
}

const STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const TERMINAL = ['completed', 'cancelled', 'voided'];

const STATUS_VARIANT: Record<string, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
    pending: 'warning',
    preparing: 'info',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'error',
    voided: 'error',
};

const currency = (n: number) => `₱${Number(n).toFixed(2)}`;

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium text-foreground">{value}</span>
        </div>
    );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className ?? ''}`}>{children}</div>;
}

export default function OrderShow({ order, delivery_men, can }: Props) {
    const [proofOpen, setProofOpen] = useState(false);
    const [markingPaid, setMarkingPaid] = useState(false);

    function markPaid() {
        setMarkingPaid(true);
        router.post(adminOrdersMarkPaid(order.id), {}, {
            preserveScroll: true,
            onFinish: () => setMarkingPaid(false),
        });
    }
    const [deliveryManId, setDeliveryManId] = useState<string>(order.delivery_man ? String(order.delivery_man.id) : '');
    const [assigning, setAssigning] = useState(false);

    function assignDeliveryMan() {
        setAssigning(true);
        router.patch(adminOrdersAssignDeliveryMan(order.id), { delivery_man_id: deliveryManId || null }, {
            onFinish: () => setAssigning(false),
        });
    }

    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const { data, setData, patch, processing } = useForm({ status: order.status });
    const [voidModal, setVoidModal] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [voiding, setVoiding] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);
    const isTerminal = TERMINAL.includes(order.status);

    useEffect(() => {
        if (flash?.success) {
toast.success(flash.success);
}

        if (flash?.error) {
toast.error(flash.error);
}
    }, [flash]);

    function updateStatus(e: React.FormEvent) {
        e.preventDefault();
        patch(adminOrdersUpdateStatus(order.id));
    }

    function confirmVoid() {
        setVoiding(true);
        router.post(adminOrdersVoid(order.id), { void_reason: voidReason }, {
            onSuccess: () => {
 setVoidModal(false); setVoiding(false); 
},
            onError: () => setVoiding(false),
        });
    }

    const hasLoyalty = (order.points_earned > 0) || (order.points_redeemed > 0) || order.free_drink_redeemed || (order.cups_awarded > 0) || order.promo;

    return (
        <AdminLayout>
            <Head title={`Order ${order.order_number}`} />
            <Toaster position="top-right" />

            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
                <Link href={adminOrdersIndex()} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Order <span className="font-mono">{order.order_number}</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                </div>
                <Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'} className="capitalize">{order.status}</Badge>
                <div className="ml-auto flex items-center gap-2">
                    {can.void_orders && !isTerminal && (
                        <Button variant="destructive" onClick={() => {
 setVoidModal(true); setVoidReason(''); 
}}>
                            <Ban className="h-4 w-4" /> Void Order
                        </Button>
                    )}
                    <Button onClick={() => receiptRef.current && printReceipt(receiptRef.current)}>
                        <Printer className="h-4 w-4" /> Print Receipt
                    </Button>
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
                        <div className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error/10 p-4">
                            <Ban className="mt-0.5 h-5 w-5 flex-shrink-0 text-error" />
                            <div>
                                <p className="font-semibold text-error">This order was voided</p>
                                {order.voided_by && <p className="text-sm text-error/80">By {order.voided_by.name}</p>}
                                {order.void_reason && <p className="mt-1 text-sm text-error/80">"{order.void_reason}"</p>}
                            </div>
                        </div>
                    )}

                    {/* Items */}
                    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                        <div className="border-b border-border px-5 py-3">
                            <h2 className="font-semibold text-foreground">
                                Items ({order.items.length})
                            </h2>
                        </div>
                        <div className="divide-y divide-border">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                        {item.quantity}×
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                                            {item.menu_item.name}
                                            {item.variation && (
                                                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                                    {item.variation.name}
                                                </span>
                                            )}
                                        </p>
                                        {item.addons.length > 0 && (
                                            <ul className="mt-1 space-y-0.5">
                                                {item.addons.map((a, i) => (
                                                    <li key={i} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                        <span>
                                                            {a.group_name && <span className="opacity-70">{a.group_name}: </span>}
                                                            <span className="font-medium text-foreground">{a.name}</span>
                                                        </span>
                                                        {Number(a.additional_price) !== 0 && (
                                                            <span>{Number(a.additional_price) > 0 ? '+' : '-'}{currency(Math.abs(Number(a.additional_price)))}</span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {item.notes && (
                                            <p className="mt-0.5 text-xs text-muted-foreground italic">Note: {item.notes}</p>
                                        )}
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="font-bold text-primary">{currency(item.subtotal)}</p>
                                        <p className="text-xs text-muted-foreground">{currency(item.unit_price)} ea.</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Totals */}
                        <div className="space-y-1.5 border-t border-border px-5 py-4">
                            <InfoRow label="Subtotal" value={currency(order.subtotal)} />
                            {Number(order.discount) > 0 && (
                                <InfoRow label="Discount" value={<span className="text-error">-{currency(order.discount)}</span>} />
                            )}
                            <InfoRow label="Tax" value={currency(order.tax)} />
                            <div className="mt-2 border-t border-border pt-2">
                                <div className="flex justify-between">
                                    <span className="font-bold text-foreground">Total</span>
                                    <span className="text-lg font-bold text-primary">{currency(order.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status update */}
                    {can.manage_orders && !isTerminal && (
                        <form onSubmit={updateStatus}>
                            <Card>
                                <h2 className="mb-3 font-semibold text-foreground">Update Status</h2>
                                <div className="flex gap-3">
                                    <select
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        className={adminFieldClass() + ' flex-1'}
                                    >
                                        {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                                    </select>
                                    <Button type="submit" disabled={processing}>
                                        {processing ? 'Saving…' : 'Update'}
                                    </Button>
                                </div>
                            </Card>
                        </form>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-4">

                    {/* Order info */}
                    <Card>
                        <h2 className="mb-3 font-semibold text-foreground">Order Info</h2>
                        <div className="space-y-0.5">
                            <InfoRow label="Table" value={order.table?.name ?? '—'} />
                            <InfoRow label="Type" value={<span className="capitalize">{order.type.replace('-', ' ')}</span>} />
                            <InfoRow label="Created by" value={order.creator?.name ?? 'Customer'} />
                            {order.notes && <InfoRow label="Notes" value={<span className="italic">{order.notes}</span>} />}
                        </div>
                    </Card>

                    {/* Customer */}
                    {order.customer && (
                        <Card>
                            <div className="mb-3 flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <h2 className="font-semibold text-foreground">Customer</h2>
                            </div>
                            <InfoRow label="Name" value={order.customer.name} />
                            <InfoRow label="Email" value={<span className="text-xs">{order.customer.email}</span>} />
                            {order.customer.phone && <InfoRow label="Phone" value={order.customer.phone} />}
                        </Card>
                    )}

                    {/* Delivery details & rider assignment */}
                    {order.type === 'delivery' && (
                        <Card>
                            <div className="mb-3 flex items-center gap-2">
                                <Bike className="h-4 w-4 text-primary" />
                                <h2 className="font-semibold text-foreground">Delivery</h2>
                            </div>

                            {order.delivery_address && (
                                <div className="mb-3 flex items-start gap-2 text-sm">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                    <div>
                                        <p className="text-foreground">{order.delivery_address}</p>
                                        {order.delivery_lat && order.delivery_lng && (
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${order.delivery_lat}&mlon=${order.delivery_lng}#map=17/${order.delivery_lat}/${order.delivery_lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-medium text-primary underline"
                                            >
                                                View pinned location on map
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Assigned delivery man</p>
                            {can.manage_orders && !isTerminal ? (
                                <div className="flex gap-2">
                                    <select
                                        value={deliveryManId}
                                        onChange={(e) => setDeliveryManId(e.target.value)}
                                        className={adminFieldClass() + ' flex-1'}
                                    >
                                        <option value="">— Unassigned —</option>
                                        {delivery_men.map((man) => (
                                            <option key={man.id} value={man.id}>
                                                {man.name}{man.vehicle ? ` (${man.vehicle})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <Button
                                        onClick={assignDeliveryMan}
                                        disabled={assigning || deliveryManId === (order.delivery_man ? String(order.delivery_man.id) : '')}
                                    >
                                        {assigning ? 'Saving…' : 'Assign'}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm font-medium text-foreground">
                                    {order.delivery_man ? `${order.delivery_man.name}${order.delivery_man.phone ? ` · ${order.delivery_man.phone}` : ''}` : '— Unassigned —'}
                                </p>
                            )}
                            {order.delivery_man?.phone && can.manage_orders && !isTerminal && (
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    📞 {order.delivery_man.phone}{order.delivery_man.vehicle ? ` · ${order.delivery_man.vehicle}` : ''}
                                </p>
                            )}
                        </Card>
                    )}

                    {/* Payment */}
                    <Card>
                        <div className="mb-3 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <h2 className="font-semibold text-foreground">Payment</h2>
                        </div>
                        {order.payment ? (
                            <div className="space-y-0.5">
                                <InfoRow label="Method" value={<span className="capitalize">{order.payment.method}</span>} />
                                <InfoRow label="Amount" value={currency(order.payment.amount)} />
                                {order.payment.reference_no && <InfoRow label="Reference" value={<span className="font-mono text-xs">{order.payment.reference_no}</span>} />}
                                <InfoRow label="Paid at" value={new Date(order.payment.paid_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })} />
                            </div>
                        ) : order.payment_method ? (
                            <div className="space-y-2">
                                <InfoRow label="Method" value={<span className="uppercase">{order.payment_method}</span>} />
                                {order.payment_proof_url ? (
                                    <div>
                                        <p className="mb-1 text-xs text-muted-foreground">Proof of payment — click to enlarge</p>
                                        <button onClick={() => setProofOpen(true)} className="block w-full">
                                            <img src={order.payment_proof_url} alt="Proof of payment" className="max-h-48 w-full rounded-xl border border-border bg-muted object-contain transition-opacity hover:opacity-80" />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">Cash on delivery — collect on handoff</p>
                                )}

                                {can.manage_orders && !isTerminal && (
                                    <div className="pt-1">
                                        {order.payment_method === 'cod' && order.type === 'delivery' && !order.delivery_man ? (
                                            <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
                                                ⚠️ Assign a delivery man first — the rider verifies the cash payment on handoff.
                                            </p>
                                        ) : (
                                            <Button
                                                onClick={markPaid}
                                                disabled={markingPaid}
                                                className="w-full bg-success text-success-foreground hover:bg-success/90"
                                            >
                                                <BadgeCheck className="h-4 w-4" />
                                                {markingPaid
                                                    ? 'Saving…'
                                                    : order.payment_method === 'cod'
                                                        ? order.type === 'delivery'
                                                            ? `Confirm cash collected by ${order.delivery_man!.name}`
                                                            : 'Confirm cash collected at counter'
                                                        : `Approve ${order.payment_method?.toUpperCase()} & mark as paid`}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No payment recorded</p>
                        )}
                    </Card>

                    {/* Loyalty & Promos */}
                    {hasLoyalty && (
                        <Card>
                            <div className="mb-3 flex items-center gap-2">
                                <Star className="h-4 w-4 text-primary" />
                                <h2 className="font-semibold text-foreground">Loyalty & Promos</h2>
                            </div>
                            <div className="space-y-0.5">
                                {order.promo && (
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Tag className="h-3.5 w-3.5" /> Promo
                                        </span>
                                        <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                            {order.promo.code}
                                        </span>
                                    </div>
                                )}
                                {order.points_earned > 0 && (
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Star className="h-3.5 w-3.5" /> Points earned
                                        </span>
                                        <span className="text-sm font-bold text-warning">+{order.points_earned}</span>
                                    </div>
                                )}
                                {order.points_redeemed > 0 && (
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Star className="h-3.5 w-3.5" /> Points redeemed
                                        </span>
                                        <span className="text-sm font-bold text-error">-{order.points_redeemed}</span>
                                    </div>
                                )}
                                {order.cups_awarded > 0 && (
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Coffee className="h-3.5 w-3.5" /> Cups awarded
                                        </span>
                                        <span className="text-sm font-bold text-foreground">+{order.cups_awarded}</span>
                                    </div>
                                )}
                                {order.free_drink_redeemed && (
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Gift className="h-3.5 w-3.5" /> Free drink
                                        </span>
                                        <Badge variant="success">Redeemed</Badge>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Void modal */}
            <CrudModal
                open={voidModal}
                onOpenChange={setVoidModal}
                title="Void Order"
                description={<><span className="font-mono font-bold">{order.order_number}</span> · {currency(order.total)}</>}
                className="max-w-sm"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setVoidModal(false)}>Cancel</Button>
                        <Button variant="destructive" className="flex-1" onClick={confirmVoid} disabled={voiding}>
                            {voiding ? 'Voiding…' : 'Void Order'}
                        </Button>
                    </>
                }
            >
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Reason (optional)</label>
                    <textarea
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        rows={3}
                        placeholder="e.g. Customer changed their mind, duplicate order…"
                        className={adminFieldClass() + ' resize-none'}
                    />
                </div>
            </CrudModal>

            {/* Proof of payment lightbox */}
            <AnimatePresence>
                {proofOpen && order.payment_proof_url && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/70" onClick={() => setProofOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed top-1/2 left-1/2 z-[80] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 p-4"
                            onClick={() => setProofOpen(false)}
                        >
                            <img src={order.payment_proof_url} alt="Proof of payment" className="max-h-[85vh] w-full rounded-2xl bg-card object-contain shadow-2xl" />
                            <button onClick={() => setProofOpen(false)} className="absolute top-2 right-2 rounded-full bg-white p-2 shadow-lg">
                                <X className="h-5 w-5 text-gray-700" />
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
