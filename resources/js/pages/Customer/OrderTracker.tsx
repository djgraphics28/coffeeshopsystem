import { Head, Link } from '@inertiajs/react';
import { storefrontOrdersCancel, storefrontShow } from '@/lib/routes';
import toast, { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, ChefHat, Clock, Heart, Phone, ShoppingBag, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import '../../echo';
import CustomerNav from '@/components/CustomerNav';

/* Retro-geometric palette shared with the storefront */
const P = {
    cream: '#E4DACB',
    creamLight: '#EFE8DC',
    navy: '#232B4A',
    navyDeep: '#1B2240',
    terracotta: '#C05B2D',
    caramel: '#B5824F',
    espresso: '#3B2A1D',
    sand: '#D8CBB8',
    green: '#5B8A4E',
};

interface OrderAddon {
    id: number;
    name: string;
    group_name: string;
    additional_price: number;
}

interface OrderItem {
    id: number;
    menu_item: { id: number; name: string; image_url: string | null };
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes: string | null;
    addons: OrderAddon[];
}

interface Order {
    id: number;
    order_number: string;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    type: string;
    subtotal: number;
    tax: number;
    delivery_fee: number;
    total: number;
    notes: string | null;
    delivery_address: string | null;
    payment_method: string | null;
    payment_proof_url: string | null;
    delivery_man: { id: number; name: string; phone: string | null; vehicle: string | null } | null;
    table: { id: number; name: string; qr_token: string } | null;
    items: OrderItem[];
}

const PAYMENT_LABELS: Record<string, string> = {
    cod: '💵 Cash on Delivery',
    gcash: 'GCash',
    maya: 'Maya',
};

interface Props {
    order: Order;
    settings: { cafe_name: string; estimated_wait_minutes: string };
}

function statusSteps(orderType: string) {
    const lastStep = orderType === 'delivery'
        ? { key: 'ready', label: 'Out for Delivery', icon: ShoppingBag, description: 'Your order is on its way to you! 🛵' }
        : { key: 'ready', label: 'Ready for Pickup', icon: ShoppingBag, description: 'Your order is ready! Come get it.' };

    return [
        { key: 'pending', label: 'Order Received', icon: CheckCircle, description: "We've got your order!" },
        { key: 'preparing', label: 'Preparing', icon: ChefHat, description: 'Our baristas are crafting your drinks' },
        lastStep,
    ];
}

export default function OrderTracker({ order: initialOrder, settings }: Props) {
    const [order, setOrder] = useState(initialOrder);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

    async function cancelOrder() {
        setCancelConfirmOpen(false);
        setIsCancelling(true);
        try {
            const response = await fetch(storefrontOrdersCancel(order.id), {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                toast.error(data?.message ?? 'Unable to cancel this order.');
                return;
            }
            setOrder(data.order);
            toast.success('Your order has been cancelled.');
        } catch {
            toast.error('Unable to cancel this order. Please try again.');
        } finally {
            setIsCancelling(false);
        }
    }

    useEffect(() => {
        if (!window.Echo) return;

        const channel = window.Echo.channel(`order.${order.id}`);
        channel.listen('.status.updated', (e: { order: Order }) => {
            setOrder(e.order);
        });

        return () => {
            window.Echo.leaveChannel(`order.${order.id}`);
        };
    }, [order.id]);

    const steps = statusSteps(order.type);
    const currentStepIndex = steps.findIndex((s) => s.key === order.status);
    const isCompleted = order.status === 'completed';
    const isCancelled = order.status === 'cancelled';

    return (
        <div className="customer-page min-h-screen pb-20" style={{ background: P.cream, fontFamily: "'DM Sans', sans-serif", color: P.espresso }}>
            <Head title={isCompleted ? `Thank You! — ${settings.cafe_name}` : `Order ${order.order_number} — ${settings.cafe_name}`} />
            <Toaster position="top-center" />

            <AnimatePresence mode="wait">
                {isCompleted ? (
                    /* ── Thank You Screen ───────────────────────────────── */
                    <motion.div
                        key="thankyou"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-screen flex-col"
                        style={{ background: `linear-gradient(160deg, ${P.navy} 0%, ${P.navyDeep} 100%)` }}
                    >
                        {/* Floating particles */}
                        <div className="pointer-events-none fixed inset-0 overflow-hidden">
                            {['☕', '✨', '🍪', '⭐', '🧡'].map((emoji, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute text-2xl"
                                    style={{ left: `${10 + i * 20}%`, top: '-10%' }}
                                    animate={{ y: ['0%', '120vh'], rotate: [0, 360], opacity: [0, 1, 1, 0] }}
                                    transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.8, ease: 'linear' }}
                                >
                                    {emoji}
                                </motion.div>
                            ))}
                        </div>

                        {/* Main content */}
                        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                            {/* Big icon */}
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                                className="mb-6 flex h-28 w-28 items-center justify-center rounded-full"
                                style={{ background: P.terracotta, boxShadow: '0 0 60px rgba(192,91,45,0.45)' }}
                            >
                                <span className="text-5xl">☕</span>
                            </motion.div>

                            {/* Headline */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                                <h1 className="text-4xl font-black uppercase tracking-tight text-white">Thank You!</h1>
                                <p className="mt-2 text-lg" style={{ color: P.cream, fontFamily: "'Playfair Display', serif" }}>
                                    for your order
                                </p>
                            </motion.div>

                            {/* Order number badge */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 }}
                                className="mt-6 px-6 py-4"
                                style={{ background: 'rgba(192,91,45,0.15)', border: `2px solid ${P.terracotta}` }}
                            >
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P.sand }}>Order Number</p>
                                <p className="mt-1 font-bold text-white" style={{ fontFamily: "'Space Mono', monospace", fontSize: '22px', letterSpacing: 2 }}>
                                    {order.order_number}
                                </p>
                            </motion.div>

                            {/* Order summary */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.65 }}
                                className="mt-6 w-full p-4 text-left"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.12)' }}
                            >
                                <div className="space-y-2">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span style={{ color: P.cream }}>
                                                {item.quantity}× {item.menu_item.name}
                                            </span>
                                            <span style={{ color: P.caramel }}>₱{Number(item.subtotal).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                                    <div className="flex justify-between font-bold">
                                        <span className="text-white uppercase text-sm tracking-wide">Total Paid</span>
                                        <span style={{ color: P.terracotta, fontSize: '18px' }}>₱{Number(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Heart message */}
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className="mt-6 flex items-center gap-1.5 text-sm"
                                style={{ color: P.sand }}
                            >
                                <Heart className="h-4 w-4 fill-current" style={{ color: P.terracotta }} />
                                We hope you enjoy every sip!
                            </motion.p>

                            {/* Star rating prompt */}
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-3 flex gap-1">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Star key={s} className="h-5 w-5 fill-current" style={{ color: P.caramel }} />
                                ))}
                            </motion.div>
                        </div>

                        {/* Bottom action */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                            className="mx-auto w-full max-w-md px-6 pb-10"
                        >
                            <Link
                                href={order.table?.qr_token ? storefrontShow(order.table.qr_token) : '/order'}
                                className="block w-full py-4 text-center text-sm font-bold uppercase tracking-widest transition-transform active:scale-95"
                                style={{ background: P.terracotta, color: 'white' }}
                            >
                                + Order More
                            </Link>
                            <p className="mt-4 text-center text-xs" style={{ color: P.sand }}>
                                {settings.cafe_name} · Thank you for dining with us
                            </p>
                        </motion.div>
                    </motion.div>
                ) : (
                    /* ── Tracking Screen ─────────────────────────────────── */
                    <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {/* Header */}
                        <div className="px-5 py-6" style={{ background: P.navy }}>
                            <div className="mx-auto flex max-w-2xl items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: P.terracotta }}>
                                    <span className="text-lg">☕</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P.sand }}>Order Tracker</p>
                                    <p className="font-bold text-white" style={{ fontFamily: "'Space Mono', monospace", fontSize: '20px' }}>
                                        {order.order_number}
                                    </p>
                                </div>
                                <span className="ml-auto rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: P.terracotta }}>
                                    {order.table ? order.table.name : order.type}
                                </span>
                            </div>
                        </div>

                        <div className="mx-auto max-w-2xl px-4 py-6 md:grid md:grid-cols-2 md:gap-4">
                            {/* Status Tracker */}
                            <div>
                                {!isCancelled ? (
                                    <div className="mb-4 p-5" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                                        <h2 className="mb-4 text-sm font-black uppercase tracking-wide" style={{ color: P.espresso }}>
                                            Order Status
                                        </h2>
                                        <div className="relative">
                                            {steps.map((step, index) => {
                                                const isDone = index <= currentStepIndex;
                                                const isActive = index === currentStepIndex;
                                                const Icon = step.icon;

                                                return (
                                                    <div key={step.key} className="flex items-start gap-4 pb-6 last:pb-0">
                                                        {index < steps.length - 1 && (
                                                            <div
                                                                className="absolute left-5 mt-10 w-0.5"
                                                                style={{ background: isDone && index < currentStepIndex ? P.terracotta : P.sand, top: `${index * 80}px`, height: '64px' }}
                                                            />
                                                        )}
                                                        <motion.div
                                                            animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                                                            transition={{ repeat: Infinity, duration: 2 }}
                                                            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                                            style={{ background: isDone ? P.terracotta : P.sand, zIndex: 1 }}
                                                        >
                                                            <Icon className="h-5 w-5" style={{ color: isDone ? 'white' : P.caramel }} />
                                                        </motion.div>
                                                        <div className="pt-1.5">
                                                            <p className="text-sm font-bold" style={{ color: isDone ? P.espresso : P.caramel }}>
                                                                {step.label}
                                                            </p>
                                                            {isActive && (
                                                                <motion.p
                                                                    initial={{ opacity: 0, y: -5 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    className="mt-0.5 text-xs"
                                                                    style={{ color: P.terracotta }}
                                                                >
                                                                    {step.description}
                                                                </motion.p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {order.status === 'pending' && (
                                            <>
                                                <div className="mt-4 flex items-center gap-2 px-3 py-2" style={{ background: P.cream, border: `2px solid ${P.sand}` }}>
                                                    <Clock className="h-4 w-4" style={{ color: P.terracotta }} />
                                                    <p className="text-xs" style={{ color: P.espresso }}>
                                                        Estimated wait: <span className="font-bold">{settings.estimated_wait_minutes} mins</span>
                                                    </p>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 px-3 py-2.5 text-white" style={{ background: P.navy }}>
                                                    <Phone className="h-4 w-4 shrink-0" style={{ color: P.cream }} />
                                                    <p className="text-xs font-semibold">
                                                        Our staff will call you to confirm your order. Please keep your phone handy!
                                                    </p>
                                                </div>
                                            </>
                                        )}

                                        {order.status === 'ready' && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="mt-4 p-4 text-center text-white"
                                                style={{ background: P.green }}
                                            >
                                                <p className="text-xl">🎉</p>
                                                <p className="mt-1 font-black uppercase tracking-wide">
                                                    {order.type === 'delivery' ? 'Your order is on the way!' : 'Your order is ready!'}
                                                </p>
                                                <p className="text-sm opacity-90">
                                                    {order.type === 'delivery'
                                                        ? 'Our rider is heading to your address. Keep your phone handy!'
                                                        : 'Please proceed to the counter to pick up your order.'}
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mb-4 p-5 text-center" style={{ background: P.creamLight, border: `2px solid ${P.terracotta}` }}>
                                        <p className="text-2xl">😔</p>
                                        <p className="mt-2 font-black uppercase tracking-wide" style={{ color: P.terracotta }}>Order Cancelled</p>
                                        <p className="text-sm" style={{ color: P.caramel }}>Please speak with a staff member for assistance.</p>
                                    </div>
                                )}

                                {/* Cancel order — only while still pending */}
                                {!isCancelled && (
                                    <div className="mb-4">
                                        <button
                                            onClick={() => setCancelConfirmOpen(true)}
                                            disabled={order.status !== 'pending' || isCancelling}
                                            className="w-full py-3 text-sm font-bold uppercase tracking-widest transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                                            style={{ border: `2px solid ${P.terracotta}`, color: P.terracotta, background: 'transparent' }}
                                        >
                                            {isCancelling ? 'Cancelling...' : '✕ Cancel Order'}
                                        </button>
                                        <p className="mt-1.5 text-center text-[10px]" style={{ color: P.caramel }}>
                                            {order.status === 'pending'
                                                ? 'You can cancel while the order has not been started.'
                                                : 'This order is already being prepared and can no longer be cancelled.'}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                {/* Order Summary */}
                                <div className="p-5" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                                    <h2 className="mb-3 text-sm font-black uppercase tracking-wide" style={{ color: P.espresso }}>
                                        Order Summary
                                    </h2>
                                    <div className="space-y-3">
                                        {order.items.map((item) => (
                                            <div key={item.id} className="flex justify-between text-sm">
                                                <div>
                                                    <p className="font-bold" style={{ color: P.espresso }}>
                                                        {item.quantity}× {item.menu_item.name}
                                                    </p>
                                                    {item.addons.length > 0 && (
                                                        <p className="text-xs" style={{ color: P.caramel }}>{item.addons.map((a) => a.name).join(', ')}</p>
                                                    )}
                                                </div>
                                                <p className="font-bold" style={{ color: P.espresso }}>₱{Number(item.subtotal).toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 pt-3" style={{ borderTop: `2px solid ${P.sand}` }}>
                                        <div className="flex justify-between text-xs" style={{ color: P.caramel }}>
                                            <span>Subtotal</span><span>₱{Number(order.subtotal).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs" style={{ color: P.caramel }}>
                                            <span>Tax</span><span>₱{Number(order.tax).toFixed(2)}</span>
                                        </div>
                                        {Number(order.delivery_fee) > 0 && (
                                            <div className="flex justify-between text-xs" style={{ color: P.caramel }}>
                                                <span>🛵 Delivery fee</span><span>₱{Number(order.delivery_fee).toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="mt-1 flex justify-between font-black">
                                            <span className="uppercase text-sm tracking-wide" style={{ color: P.espresso }}>Total</span>
                                            <span style={{ color: P.terracotta }}>₱{Number(order.total).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment & delivery details (online orders) */}
                                {(order.payment_method || order.delivery_address) && (
                                    <div className="mt-4 p-5" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                                        <h2 className="mb-3 text-sm font-black uppercase tracking-wide" style={{ color: P.espresso }}>
                                            Payment & Delivery
                                        </h2>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span style={{ color: P.caramel }}>Order type</span>
                                                <span className="font-bold capitalize" style={{ color: P.espresso }}>{order.type}</span>
                                            </div>
                                            {order.payment_method && (
                                                <div className="flex justify-between">
                                                    <span style={{ color: P.caramel }}>Payment method</span>
                                                    <span className="font-bold" style={{ color: P.espresso }}>
                                                        {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                                                    </span>
                                                </div>
                                            )}
                                            {order.delivery_address && (
                                                <div>
                                                    <p style={{ color: P.caramel }}>Deliver to</p>
                                                    <p className="mt-0.5 font-semibold" style={{ color: P.espresso }}>{order.delivery_address}</p>
                                                </div>
                                            )}
                                            {order.delivery_man && (
                                                <div className="flex items-center gap-3 p-3" style={{ background: P.cream, border: `2px solid ${P.sand}` }}>
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: P.terracotta }}>
                                                        🛵
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: P.caramel }}>Your rider</p>
                                                        <p className="truncate font-bold" style={{ color: P.espresso }}>{order.delivery_man.name}</p>
                                                        {order.delivery_man.phone && (
                                                            <a href={`tel:${order.delivery_man.phone}`} className="text-xs font-semibold" style={{ color: P.terracotta }}>
                                                                📞 {order.delivery_man.phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {order.payment_proof_url && (
                                            <div className="mt-3 pt-3" style={{ borderTop: `2px solid ${P.sand}` }}>
                                                <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: P.caramel }}>Your proof of payment</p>
                                                <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer">
                                                    <img
                                                        src={order.payment_proof_url}
                                                        alt="Proof of payment"
                                                        className="max-h-64 w-full object-contain"
                                                        style={{ border: `2px solid ${P.sand}`, background: 'white' }}
                                                    />
                                                </a>
                                                <p className="mt-1 text-center text-[10px]" style={{ color: P.caramel }}>Tap to view full size</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Order More */}
                                <Link
                                    href={order.table?.qr_token ? storefrontShow(order.table.qr_token) : '/order'}
                                    className="mt-4 block w-full py-3.5 text-center text-sm font-bold uppercase tracking-widest text-white"
                                    style={{ background: P.navy }}
                                >
                                    + Order More
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancel confirmation dialog */}
            <AnimatePresence>
                {cancelConfirmOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50"
                            style={{ zIndex: 80 }}
                            onClick={() => setCancelConfirmOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 p-6 text-center"
                            style={{ zIndex: 90, background: P.creamLight, border: `3px solid ${P.terracotta}` }}
                        >
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: P.terracotta }}>
                                😢
                            </div>
                            <h2 className="mt-3 text-lg font-black uppercase tracking-tight" style={{ color: P.espresso }}>
                                Cancel this order?
                            </h2>
                            <p className="mt-1 text-sm" style={{ color: P.caramel }}>
                                Order <span className="font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</span> will
                                be cancelled and any points or rewards used will be refunded. This cannot be undone.
                            </p>
                            <div className="mt-5 space-y-2">
                                <button
                                    onClick={cancelOrder}
                                    className="w-full py-3 text-sm font-bold uppercase tracking-widest text-white"
                                    style={{ background: P.terracotta }}
                                >
                                    Yes, cancel my order
                                </button>
                                <button
                                    onClick={() => setCancelConfirmOpen(false)}
                                    className="w-full py-3 text-sm font-bold uppercase tracking-widest"
                                    style={{ border: `2px solid ${P.navy}`, color: P.navy, background: 'transparent' }}
                                >
                                    Keep my order
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {!isCompleted && <CustomerNav current="track" />}
        </div>
    );
}
