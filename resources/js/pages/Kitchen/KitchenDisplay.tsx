import { Head } from '@inertiajs/react';
import { kitchenOrdersUpdateStatus } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Clock, LayoutDashboard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../../echo';

interface OrderAddon {
    id: number;
    name: string;
    group_name: string;
}

interface OrderItem {
    id: number;
    menu_item: { id: number; name: string };
    quantity: number;
    notes: string | null;
    addons: OrderAddon[];
}

interface Order {
    id: number;
    order_number: string;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    type: string;
    table: { id: number; name: string } | null;
    items: OrderItem[];
    total: number;
    created_at: string;
}

interface Props {
    initialOrders: Order[];
}

function sortOrdersFifo(list: Order[]): Order[] {
    return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

const STATUS_CONFIG = {
    pending: { label: 'New Orders', color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: '#1C1917', border: '#F59E0B' },
    preparing: { label: 'Preparing', color: '#3B82F6', glow: 'rgba(59,130,246,0.3)', bg: '#1C1917', border: '#3B82F6' },
    ready: { label: 'Ready', color: '#22C55E', glow: 'rgba(34,197,94,0.3)', bg: '#1C1917', border: '#22C55E' },
};

function useElapsedTime(createdAt: string): string {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        function update() {
            const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
            if (diff < 60) setElapsed(`${diff}s`);
            else if (diff < 3600) setElapsed(`${Math.floor(diff / 60)}m ${diff % 60}s`);
            else setElapsed(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`);
        }
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [createdAt]);

    return elapsed;
}

function OrderCard({
    order,
    updating,
    onUpdateStatus,
}: {
    order: Order;
    updating: boolean;
    onUpdateStatus: (id: number, status: string) => void;
}) {
    const elapsed = useElapsedTime(order.created_at);
    const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];

    const nextStatus = order.status === 'pending' ? 'preparing' : order.status === 'preparing' ? 'ready' : 'completed';
    const nextLabel = order.status === 'pending' ? 'Start Preparing' : order.status === 'preparing' ? 'Mark Ready' : 'Complete';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="rounded-2xl p-4"
            style={{
                background: '#1E1E1E',
                border: `2px solid ${config.border}`,
                boxShadow: `0 0 20px ${config.glow}`,
            }}
        >
            {/* Card Header */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace", fontSize: '22px', color: config.color }}>
                        {order.order_number}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-400">
                        {order.table ? order.table.name : 'Walk-in'} •{' '}
                        <span className="capitalize">{order.type.replace('-', ' ')}</span>
                    </p>
                </div>
                <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                    <Clock className="h-3 w-3" />
                    <span style={{ fontFamily: "'Space Mono', monospace" }}>{elapsed}</span>
                </div>
            </div>

            {/* Items */}
            <div className="mt-3 space-y-2">
                {order.items.map((item) => (
                    <div key={item.id} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="font-semibold text-white">
                            <span style={{ color: config.color }}>{item.quantity}×</span> {item.menu_item.name}
                        </p>
                        {item.addons.length > 0 && (
                            <p className="mt-0.5 text-xs text-gray-500">
                                {item.addons.map((a) => a.name).join(' · ')}
                            </p>
                        )}
                        {item.notes && (
                            <p className="mt-0.5 text-xs italic" style={{ color: '#F59E0B' }}>
                                ⚠ {item.notes}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Action Button */}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
                <button
                    onClick={() => !updating && onUpdateStatus(order.id, nextStatus)}
                    disabled={updating}
                    className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition-all"
                    style={{
                        background: updating ? 'rgba(255,255,255,0.1)' : config.color,
                        color: updating ? '#6B7280' : '#111827',
                        cursor: updating ? 'not-allowed' : 'pointer',
                    }}
                >
                    {updating ? '...' : nextLabel}
                </button>
            )}
        </motion.div>
    );
}

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
const socketId = () => window.Echo?.socketId() ?? '';

export default function KitchenDisplay({ initialOrders }: Props) {
    const [orders, setOrders] = useState<Order[]>(() => sortOrdersFifo(initialOrders));
    const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
    const [soundEnabled, setSoundEnabled] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);

    const playChime = useCallback(
        (type: 'new' | 'ready') => {
            if (!soundEnabled) return;
            try {
                const ctx = audioContextRef.current ?? new AudioContext();
                audioContextRef.current = ctx;
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();
                oscillator.connect(gain);
                gain.connect(ctx.destination);
                oscillator.frequency.setValueAtTime(type === 'new' ? 880 : 1320, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(type === 'new' ? 1100 : 1760, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.4);
            } catch {
                // AudioContext may be blocked before user interaction
            }
        },
        [soundEnabled],
    );

    useEffect(() => {
        // Wake Lock to prevent screen sleep
        let wakeLock: WakeLockSentinel | null = null;
        navigator.wakeLock?.request('screen').then((lock) => {
            wakeLock = lock;
        }).catch(() => {});

        return () => {
            wakeLock?.release();
        };
    }, []);

    useEffect(() => {
        if (!window.Echo) return;

        window.Echo.channel('kitchen')
            .listen('.order.placed', (e: { order: Order }) => {
                playChime('new');
                setOrders((prev) => {
                    if (prev.some((o) => o.id === e.order.id)) {
                        return prev;
                    }

                    return sortOrdersFifo([...prev, e.order]);
                });
            })
            .listen('.status.updated', (e: { order: Order }) => {
                if (e.order.status === 'ready') playChime('ready');
                if (e.order.status === 'completed' || e.order.status === 'cancelled' || e.order.status === 'voided') {
                    setOrders((prev) => prev.filter((o) => o.id !== e.order.id));
                } else {
                    setOrders((prev) => sortOrdersFifo(prev.map((o) => (o.id === e.order.id ? e.order : o))));
                }
            });

        return () => {
            window.Echo.leaveChannel('kitchen');
        };
    }, [playChime]);

    async function handleUpdateStatus(orderId: number, status: string) {
        setUpdatingIds((prev) => new Set(prev).add(orderId));

        try {
            const res = await fetch(kitchenOrdersUpdateStatus(orderId), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    'X-Socket-ID': socketId(),
                },
                body: JSON.stringify({ status }),
            });

            if (!res.ok) {
                console.error('Kitchen: status update failed', res.status);
                return;
            }

            const data: { order?: Order } = await res.json().catch(() => ({}));

            if (status === 'completed' || status === 'cancelled' || status === 'voided') {
                setOrders((prev) => prev.filter((o) => o.id !== orderId));
            } else if (data.order) {
                setOrders((prev) => sortOrdersFifo(prev.map((o) => (o.id === orderId ? data.order! : o))));
            }
        } catch (err) {
            console.error('Kitchen: status update error', err);
        } finally {
            setUpdatingIds((prev) => {
                const next = new Set(prev);
                next.delete(orderId);
                return next;
            });
        }
    }

    const pendingOrders = sortOrdersFifo(orders.filter((o) => o.status === 'pending'));
    const preparingOrders = sortOrdersFifo(orders.filter((o) => o.status === 'preparing'));
    const readyOrders = sortOrdersFifo(orders.filter((o) => o.status === 'ready'));

    return (
        <div className="h-screen overflow-hidden" style={{ background: '#111111', fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="Kitchen Display — Milk&Honey Cafe" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3" style={{ background: '#1A1A1A', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-3">
                    <a
                        href="/admin"
                        className="flex items-center justify-center rounded-full transition-colors"
                        style={{ width: 32, height: 32, background: 'rgba(212,168,67,0.12)' }}
                        title="Back to Dashboard"
                    >
                        <LayoutDashboard className="h-4 w-4" style={{ color: '#D4A843' }} />
                    </a>
                    <span style={{ color: '#D4A843', fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 700 }}>
                        Milk&Honey — Kitchen
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex gap-4 text-sm">
                        <span style={{ color: '#F59E0B' }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{pendingOrders.length}</span>
                            <span className="ml-1 text-gray-400">Pending</span>
                        </span>
                        <span style={{ color: '#3B82F6' }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{preparingOrders.length}</span>
                            <span className="ml-1 text-gray-400">Preparing</span>
                        </span>
                        <span style={{ color: '#22C55E' }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{readyOrders.length}</span>
                            <span className="ml-1 text-gray-400">Ready</span>
                        </span>
                    </div>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="rounded-full p-2 transition-colors"
                        style={{ background: soundEnabled ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.05)' }}
                    >
                        {soundEnabled ? (
                            <Bell className="h-5 w-5" style={{ color: '#D4A843' }} />
                        ) : (
                            <BellOff className="h-5 w-5 text-gray-500" />
                        )}
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="grid h-[calc(100vh-56px)] grid-cols-3 gap-0">
                {(
                    [
                        { status: 'pending', orders: pendingOrders },
                        { status: 'preparing', orders: preparingOrders },
                        { status: 'ready', orders: readyOrders },
                    ] as const
                ).map(({ status, orders: columnOrders }) => {
                    const config = STATUS_CONFIG[status];
                    return (
                        <div key={status} className="flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <div className="h-2.5 w-2.5 rounded-full" style={{ background: config.color }} />
                                <span className="font-semibold text-sm" style={{ color: config.color }}>
                                    {config.label}
                                </span>
                                <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${config.color}20`, color: config.color }}>
                                    {columnOrders.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {columnOrders.map((order) => (
                                        <OrderCard
                                            key={order.id}
                                            order={order}
                                            updating={updatingIds.has(order.id)}
                                            onUpdateStatus={handleUpdateStatus}
                                        />
                                    ))}
                                </AnimatePresence>
                                {columnOrders.length === 0 && (
                                    <div className="flex flex-col items-center justify-center pt-16 text-gray-600">
                                        <p className="text-4xl opacity-20">—</p>
                                        <p className="mt-2 text-sm">No orders</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
