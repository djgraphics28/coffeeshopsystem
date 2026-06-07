import { Head, Link } from '@inertiajs/react';
import { storefrontShow } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, ChefHat, Clock, Heart, ShoppingBag, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import '../../echo';

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
    total: number;
    notes: string | null;
    table: { id: number; name: string; qr_token: string } | null;
    items: OrderItem[];
}

interface Props {
    order: Order;
    settings: { cafe_name: string; estimated_wait_minutes: string };
}

const STATUS_STEPS = [
    { key: 'pending', label: 'Order Received', icon: CheckCircle, description: "We've got your order!" },
    { key: 'preparing', label: 'Preparing', icon: ChefHat, description: 'Our baristas are crafting your drinks' },
    { key: 'ready', label: 'Ready for Pickup', icon: ShoppingBag, description: 'Your order is ready! Come get it.' },
];

export default function OrderTracker({ order: initialOrder, settings }: Props) {
    const [order, setOrder] = useState(initialOrder);

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

    const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
    const isCompleted = order.status === 'completed';
    const isCancelled = order.status === 'cancelled';

    return (
        <div className="min-h-screen" style={{ background: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", maxWidth: '430px', margin: '0 auto' }}>
            <Head title={isCompleted ? `Thank You! — ${settings.cafe_name}` : `Order ${order.order_number} — ${settings.cafe_name}`} />

            <AnimatePresence mode="wait">
                {isCompleted ? (
                    /* ── Thank You Screen ───────────────────────────────── */
                    <motion.div
                        key="thankyou"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-screen flex-col"
                        style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #3D2510 40%, #1C1008 100%)' }}
                    >
                        {/* Floating particles */}
                        <div className="pointer-events-none fixed inset-0 overflow-hidden">
                            {['☕', '✨', '🍪', '⭐', '💛'].map((emoji, i) => (
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
                        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                            {/* Big icon */}
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                                className="mb-6 flex h-28 w-28 items-center justify-center rounded-full"
                                style={{ background: '#D4A843', boxShadow: '0 0 60px rgba(212,168,67,0.4)' }}
                            >
                                <span className="text-5xl">☕</span>
                            </motion.div>

                            {/* Headline */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                                    Thank You!
                                </h1>
                                <p className="mt-2 text-lg" style={{ color: '#D4A843' }}>
                                    for your order
                                </p>
                            </motion.div>

                            {/* Order number badge */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 }}
                                className="mt-6 rounded-2xl px-6 py-4"
                                style={{ background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.3)' }}
                            >
                                <p className="text-xs text-gray-400">Order Number</p>
                                <p className="mt-1 font-bold text-white" style={{ fontFamily: "'Space Mono', monospace", fontSize: '22px', letterSpacing: 2 }}>
                                    {order.order_number}
                                </p>
                            </motion.div>

                            {/* Order summary */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.65 }}
                                className="mt-6 w-full rounded-2xl p-4 text-left"
                                style={{ background: 'rgba(255,255,255,0.06)' }}
                            >
                                <div className="space-y-2">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span style={{ color: '#E8DDD0' }}>
                                                {item.quantity}× {item.menu_item.name}
                                            </span>
                                            <span style={{ color: '#D4A843' }}>₱{Number(item.subtotal).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                    <div className="flex justify-between font-bold">
                                        <span className="text-white">Total Paid</span>
                                        <span style={{ color: '#D4A843', fontSize: '18px' }}>₱{Number(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Heart message */}
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.8 }}
                                className="mt-6 flex items-center gap-1.5 text-sm"
                                style={{ color: '#A08060' }}
                            >
                                <Heart className="h-4 w-4 fill-current" style={{ color: '#D4A843' }} />
                                We hope you enjoy every sip!
                            </motion.p>

                            {/* Star rating prompt */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                className="mt-3 flex gap-1"
                            >
                                {[1,2,3,4,5].map((s) => (
                                    <Star key={s} className="h-5 w-5 fill-current" style={{ color: s <= 5 ? '#D4A843' : '#3D2510' }} />
                                ))}
                            </motion.div>
                        </div>

                        {/* Bottom action */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                            className="px-6 pb-10"
                        >
                            {order.table?.qr_token && (
                                <Link
                                    href={storefrontShow(order.table.qr_token)}
                                    className="block w-full rounded-full py-4 text-center text-sm font-bold transition-transform active:scale-95"
                                    style={{ background: '#D4A843', color: '#2C1A0E' }}
                                >
                                    + Order More
                                </Link>
                            )}
                            <p className="mt-4 text-center text-xs" style={{ color: '#6B7280' }}>
                                {settings.cafe_name} · Thank you for dining with us
                            </p>
                        </motion.div>
                    </motion.div>
                ) : (
                    /* ── Tracking Screen ─────────────────────────────────── */
                    <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {/* Header */}
                        <div className="px-5 py-6" style={{ background: '#2C1A0E' }}>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: '#D4A843' }}>
                                    <span className="text-lg">☕</span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Order Tracker</p>
                                    <p className="font-bold text-white" style={{ fontFamily: "'Space Mono', monospace", fontSize: '20px' }}>
                                        {order.order_number}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-6">
                            {/* Status Tracker */}
                            {!isCancelled ? (
                                <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
                                    <h2 className="mb-4 font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                                        Order Status
                                    </h2>
                                    <div className="relative">
                                        {STATUS_STEPS.map((step, index) => {
                                            const isDone = index <= currentStepIndex;
                                            const isActive = index === currentStepIndex;
                                            const Icon = step.icon;

                                            return (
                                                <div key={step.key} className="flex items-start gap-4 pb-6 last:pb-0">
                                                    {index < STATUS_STEPS.length - 1 && (
                                                        <div
                                                            className="absolute left-5 mt-10 w-0.5"
                                                            style={{ background: isDone && index < currentStepIndex ? '#D4A843' : '#E5E5E5', top: `${index * 80}px`, height: '64px' }}
                                                        />
                                                    )}
                                                    <motion.div
                                                        animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                                                        transition={{ repeat: Infinity, duration: 2 }}
                                                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                                        style={{ background: isDone ? '#D4A843' : '#F3F4F6', zIndex: 1 }}
                                                    >
                                                        <Icon className="h-5 w-5" style={{ color: isDone ? '#2C1A0E' : '#9CA3AF' }} />
                                                    </motion.div>
                                                    <div className="pt-1.5">
                                                        <p className="text-sm font-semibold" style={{ color: isDone ? '#2C1A0E' : '#9CA3AF' }}>
                                                            {step.label}
                                                        </p>
                                                        {isActive && (
                                                            <motion.p
                                                                initial={{ opacity: 0, y: -5 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                className="mt-0.5 text-xs"
                                                                style={{ color: '#D4A843' }}
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
                                        <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: '#FDF6EC' }}>
                                            <Clock className="h-4 w-4" style={{ color: '#D4A843' }} />
                                            <p className="text-xs" style={{ color: '#2C1A0E' }}>
                                                Estimated wait: <span className="font-semibold">{settings.estimated_wait_minutes} mins</span>
                                            </p>
                                        </div>
                                    )}

                                    {order.status === 'ready' && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="mt-4 rounded-xl p-4 text-center"
                                            style={{ background: '#8A9E7B', color: 'white' }}
                                        >
                                            <p className="text-xl">🎉</p>
                                            <p className="mt-1 font-bold">Your order is ready!</p>
                                            <p className="text-sm opacity-90">Please proceed to the counter to pick up your order.</p>
                                        </motion.div>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-6 rounded-2xl bg-red-50 p-5 text-center">
                                    <p className="text-2xl">😔</p>
                                    <p className="mt-2 font-bold text-red-700">Order Cancelled</p>
                                    <p className="text-sm text-red-500">Please speak with a staff member for assistance.</p>
                                </div>
                            )}

                            {/* Order Summary */}
                            <div className="rounded-2xl bg-white p-5 shadow-sm">
                                <h2 className="mb-3 font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                                    Order Summary
                                </h2>
                                <div className="space-y-3">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <div>
                                                <p className="font-medium" style={{ color: '#2C1A0E' }}>
                                                    {item.quantity}× {item.menu_item.name}
                                                </p>
                                                {item.addons.length > 0 && (
                                                    <p className="text-xs text-gray-400">{item.addons.map((a) => a.name).join(', ')}</p>
                                                )}
                                            </div>
                                            <p className="font-semibold" style={{ color: '#2C1A0E' }}>₱{Number(item.subtotal).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 border-t border-gray-100 pt-3">
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Subtotal</span><span>₱{Number(order.subtotal).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Tax</span><span>₱{Number(order.tax).toFixed(2)}</span>
                                    </div>
                                    <div className="mt-1 flex justify-between font-bold">
                                        <span style={{ color: '#2C1A0E' }}>Total</span>
                                        <span style={{ color: '#D4A843' }}>₱{Number(order.total).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Order More */}
                            {order.table?.qr_token && (
                                <Link
                                    href={storefrontShow(order.table.qr_token)}
                                    className="mt-4 block w-full rounded-full py-3.5 text-center text-sm font-bold"
                                    style={{ background: '#2C1A0E', color: '#D4A843' }}
                                >
                                    + Order More
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
