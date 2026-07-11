import { Head, router, usePage } from '@inertiajs/react';
import { driverCollectPayment, driverDelivered } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, CheckCircle2, MapPin, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import DriverLayout, { DRIVER_PALETTE as P } from '@/layouts/driver-layout';

const STATUS_LABELS: Record<string, { label: string; bg: string }> = {
    pending: { label: 'Waiting for kitchen', bg: '#B5824F' },
    preparing: { label: 'Being prepared', bg: '#C05B2D' },
    ready: { label: 'Ready — deliver now!', bg: '#5B8A4E' },
};

interface OrderItem {
    id: number;
    menu_item: { name: string };
    quantity: number;
}

interface Order {
    id: number;
    order_number: string;
    status: string;
    total: number;
    delivery_address: string | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
    payment_method: string | null;
    customer: { name: string; phone: string | null } | null;
    payment: { id: number } | null;
    items: OrderItem[];
}

interface Props {
    delivery_man: { id: number; name: string; vehicle: string | null } | null;
    active_orders: Order[];
    completed_today: Order[];
    settings: { cafe_name: string; currency: string };
}

export default function DriverDashboard({ delivery_man, active_orders, completed_today, settings }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [confirming, setConfirming] = useState<{ order: Order; action: 'collect' | 'delivered' } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    function runAction() {
        if (!confirming) return;
        setBusy(true);
        const url = confirming.action === 'collect' ? driverCollectPayment(confirming.order.id) : driverDelivered(confirming.order.id);
        router.post(url, {}, {
            preserveScroll: true,
            onSuccess: () => setConfirming(null),
            onFinish: () => setBusy(false),
        });
    }

    const currency = settings.currency;

    return (
        <DriverLayout deliveryMan={delivery_man}>
            <Head title={`Driver — ${settings.cafe_name}`} />
            <>
                {!delivery_man && (
                    <div className="p-4 text-sm" style={{ background: '#FEF3C7', border: '2px solid #F59E0B', color: '#92400E' }}>
                        Your login isn't linked to a delivery man profile yet. Ask the admin to link your account on the Delivery Men page.
                    </div>
                )}

                {/* Active deliveries */}
                <h2 className="mb-3 text-sm font-black uppercase tracking-wide" style={{ color: P.espresso }}>
                    My Deliveries ({active_orders.length})
                </h2>

                {active_orders.length === 0 ? (
                    <div className="flex flex-col items-center py-14 text-center" style={{ color: P.caramel }}>
                        <span className="text-4xl">🛵</span>
                        <p className="mt-2 text-sm font-semibold">No active deliveries</p>
                        <p className="text-xs">New assignments will show up here.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {active_orders.map((order) => {
                            const st = STATUS_LABELS[order.status] ?? { label: order.status, bg: P.caramel };
                            const isCod = order.payment_method === 'cod';
                            const isPaid = !!order.payment;
                            const canDeliver = order.status === 'ready' && (!isCod || isPaid);
                            return (
                                <div key={order.id} className="p-4" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</p>
                                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: st.bg }}>
                                            {st.label}
                                        </span>
                                        <span className="ml-auto font-black" style={{ color: P.terracotta }}>{currency}{Number(order.total).toFixed(2)}</span>
                                    </div>

                                    <p className="mt-1 text-xs" style={{ color: P.caramel }}>
                                        {order.items.map((i) => `${i.quantity}× ${i.menu_item.name}`).join(', ')}
                                    </p>

                                    {/* Customer + address */}
                                    <div className="mt-3 space-y-2 text-sm">
                                        {order.customer && (
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold">{order.customer.name}</span>
                                                {order.customer.phone && (
                                                    <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white" style={{ background: P.navy }}>
                                                        <Phone className="h-3 w-3" /> Call
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                        {order.delivery_address && (
                                            <div className="flex items-start gap-2">
                                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: P.terracotta }} />
                                                <div>
                                                    <p>{order.delivery_address}</p>
                                                    {order.delivery_lat && order.delivery_lng && (
                                                        <a
                                                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-bold underline"
                                                            style={{ color: P.terracotta }}
                                                        >
                                                            Navigate 🧭
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment status */}
                                    <div className="mt-3 flex items-center gap-2 px-3 py-2 text-xs font-bold" style={{ background: isPaid ? '#DCEDDD' : '#FDEBD3', border: `2px solid ${isPaid ? P.green : P.caramel}`, color: isPaid ? '#2F5D2A' : '#8A5A18' }}>
                                        {isPaid
                                            ? <><BadgeCheck className="h-4 w-4" /> Paid{isCod ? ' — cash collected' : ' online'}</>
                                            : isCod
                                                ? <>💵 Collect {currency}{Number(order.total).toFixed(2)} cash on handoff</>
                                                : <>⏳ Online payment pending admin verification</>}
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {isCod && !isPaid ? (
                                            <button
                                                onClick={() => setConfirming({ order, action: 'collect' })}
                                                className="py-2.5 text-xs font-bold uppercase tracking-wide text-white"
                                                style={{ background: P.caramel }}
                                            >
                                                💵 Cash Collected
                                            </button>
                                        ) : <span />}
                                        <button
                                            onClick={() => setConfirming({ order, action: 'delivered' })}
                                            disabled={!canDeliver}
                                            className="col-start-2 py-2.5 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                                            style={{ background: P.green }}
                                            title={!canDeliver ? (order.status !== 'ready' ? 'Wait until the order is ready' : 'Collect the cash first') : undefined}
                                        >
                                            ✓ Delivered
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Completed today */}
                {completed_today.length > 0 && (
                    <div className="mt-8">
                        <h2 className="mb-3 text-sm font-black uppercase tracking-wide" style={{ color: P.espresso }}>
                            Delivered Today ({completed_today.length})
                        </h2>
                        <div className="space-y-2">
                            {completed_today.map((order) => (
                                <div key={order.id} className="flex items-center gap-3 p-3" style={{ background: P.creamLight, border: `2px solid ${P.sand}`, opacity: 0.75 }}>
                                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: P.green }} />
                                    <span className="text-sm font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</span>
                                    <span className="truncate text-xs" style={{ color: P.caramel }}>{order.customer?.name}</span>
                                    <span className="ml-auto text-sm font-bold" style={{ color: P.terracotta }}>{currency}{Number(order.total).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>

            {/* Confirmation dialog */}
            <AnimatePresence>
                {confirming && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50" style={{ zIndex: 80 }} onClick={() => setConfirming(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 text-center"
                            style={{ zIndex: 90, background: P.creamLight, border: `3px solid ${confirming.action === 'collect' ? P.caramel : P.green}` }}
                        >
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: confirming.action === 'collect' ? P.caramel : P.green }}>
                                {confirming.action === 'collect' ? '💵' : '📦'}
                            </div>
                            <h2 className="mt-3 text-lg font-black uppercase tracking-tight">
                                {confirming.action === 'collect' ? 'Cash collected?' : 'Mark as delivered?'}
                            </h2>
                            <p className="mt-1 text-sm" style={{ color: P.caramel }}>
                                <span className="font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{confirming.order.order_number}</span>
                                {confirming.action === 'collect'
                                    ? ` — confirm you received ${currency}${Number(confirming.order.total).toFixed(2)} in cash from the customer.`
                                    : ' — confirm the order was handed to the customer.'}
                            </p>
                            <div className="mt-5 space-y-2">
                                <button
                                    onClick={runAction}
                                    disabled={busy}
                                    className="w-full py-3 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
                                    style={{ background: confirming.action === 'collect' ? P.caramel : P.green }}
                                >
                                    {busy ? 'Saving...' : confirming.action === 'collect' ? `Yes, I received ${currency}${Number(confirming.order.total).toFixed(2)}` : 'Yes, delivered!'}
                                </button>
                                <button onClick={() => setConfirming(null)} className="w-full py-3 text-sm font-bold uppercase tracking-widest" style={{ border: `2px solid ${P.navy}`, color: P.navy }}>
                                    Not yet
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </DriverLayout>
    );
}
