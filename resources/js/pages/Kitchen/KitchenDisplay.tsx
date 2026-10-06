import { Head } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, Check, CheckCheck, ChevronDown, Clock, GripVertical, LayoutDashboard, Moon, Sun, Undo2 } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { stationOrderItemsToggle, stationOrdersCheckAll, stationOrdersUpdateStatus  } from '@/lib/routes';
import type {Station} from '@/lib/routes';
import '../../echo';

interface OrderAddon {
    id: number;
    name: string;
    group_name: string;
}

interface OrderItem {
    id: number;
    menu_item: { id: number; name: string; is_kitchen?: boolean };
    variation?: { id: number; name: string } | null;
    quantity: number;
    notes: string | null;
    is_done?: boolean;
    addons: OrderAddon[];
}

interface Order {
    id: number;
    order_number: string;
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    kitchen_status?: string | null;
    barista_status?: string | null;
    type: string;
    table: { id: number; name: string } | null;
    items: OrderItem[];
    notes?: string | null;
    total: number;
    created_at: string;
}

interface Props {
    station: Station;
    initialOrders: Order[];
}

/**
 * A station only sees the items it prepares, and the order is shown at that station's own progress.
 * Returns null when the order has nothing for this station or the station has finished it.
 */
function forStation(order: Order, station: Station): Order | null {
    const items = order.items.filter((item) => (item.menu_item.is_kitchen !== false) === (station === 'kitchen'));
    const stationStatus = station === 'kitchen' ? order.kitchen_status : order.barista_status;

    if (items.length === 0 || !stationStatus || stationStatus === 'completed') {
        return null;
    }

    return { ...order, items, status: stationStatus as Order['status'] };
}

function sortOrdersFifo(list: Order[]): Order[] {
    return [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

type Theme = 'light' | 'dark';

const STATUS_CONFIG = {
    pending: { label: 'New Orders', color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', bg: '#1C1917', border: '#F59E0B' },
    preparing: { label: 'Preparing', color: '#3B82F6', glow: 'rgba(59,130,246,0.3)', bg: '#1C1917', border: '#3B82F6' },
    ready: { label: 'Ready', color: '#22C55E', glow: 'rgba(34,197,94,0.3)', bg: '#1C1917', border: '#22C55E' },
};

/** Darker accents keep text readable on the light background. */
const LIGHT_ACCENTS = { pending: '#B45309', preparing: '#1D4ED8', ready: '#15803D' };

function statusConfig(theme: Theme, status: keyof typeof STATUS_CONFIG) {
    const base = STATUS_CONFIG[status];

    return theme === 'light'
        ? { ...base, color: LIGHT_ACCENTS[status], border: LIGHT_ACCENTS[status], glow: 'rgba(0,0,0,0.08)', on: '#FFFFFF' }
        : { ...base, on: '#111827' };
}

/** Colour tokens used throughout the board; switched by the light / dark toggle. */
const THEME_VARS: Record<Theme, Record<string, string>> = {
    dark: {
        '--k-bg': '#111111', '--k-header': '#1A1A1A', '--k-card': '#1E1E1E', '--k-text': '#FFFFFF',
        '--k-muted': '#9CA3AF', '--k-subtle': '#6B7280', '--k-faint': '#4B5563',
        '--k-line': 'rgba(255,255,255,0.05)', '--k-overlay-faint': 'rgba(255,255,255,0.02)', '--k-overlay': 'rgba(255,255,255,0.05)',
        '--k-overlay-strong': 'rgba(255,255,255,0.09)', '--k-check': 'rgba(255,255,255,0.3)', '--k-warn': '#F59E0B',
        '--k-ok': '#22C55E', '--k-ok-bg': 'rgba(34,197,94,0.15)', '--k-done-bg': 'rgba(34,197,94,0.08)', '--k-shadow': '0 20px 40px rgba(0,0,0,0.6)',
    },
    light: {
        '--k-bg': '#F3F4F6', '--k-header': '#FFFFFF', '--k-card': '#FFFFFF', '--k-text': '#111827',
        '--k-muted': '#6B7280', '--k-subtle': '#9CA3AF', '--k-faint': '#9CA3AF',
        '--k-line': 'rgba(0,0,0,0.08)', '--k-overlay-faint': 'rgba(0,0,0,0.02)', '--k-overlay': 'rgba(0,0,0,0.045)',
        '--k-overlay-strong': 'rgba(0,0,0,0.09)', '--k-check': 'rgba(0,0,0,0.3)', '--k-warn': '#B45309',
        '--k-ok': '#15803D', '--k-ok-bg': 'rgba(22,163,74,0.12)', '--k-done-bg': 'rgba(22,163,74,0.1)', '--k-shadow': '0 20px 40px rgba(0,0,0,0.18)',
    },
};

const ThemeContext = createContext<Theme>('light');

const THEME_STORAGE_KEY = 'station-theme';

function readStoredTheme(): Theme {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

function useElapsedTime(createdAt: string): string {
    const [elapsed, setElapsed] = useState('');

    useEffect(() => {
        function update() {
            const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);

            if (diff < 60) {
setElapsed(`${diff}s`);
} else if (diff < 3600) {
setElapsed(`${Math.floor(diff / 60)}m ${diff % 60}s`);
} else {
setElapsed(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`);
}
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
    onToggleItem,
    onCheckAll,
    onDragStart,
    dragging,
}: {
    order: Order;
    updating: boolean;
    onDragStart: (order: Order, event: React.PointerEvent) => void;
    dragging: boolean;
    onUpdateStatus: (id: number, status: string) => void;
    onToggleItem: (orderId: number, itemId: number, done: boolean) => void;
    onCheckAll: (orderId: number, done: boolean) => void;
}) {
    const elapsed = useElapsedTime(order.created_at);
    const theme = useContext(ThemeContext);
    const config = statusConfig(theme, order.status as keyof typeof STATUS_CONFIG);
    // Ready orders only need handing over, so they start collapsed; active ones start open.
    const [expanded, setExpanded] = useState(order.status !== 'ready');

    const nextStatus = order.status === 'pending' ? 'preparing' : order.status === 'preparing' ? 'ready' : 'completed';
    const nextLabel = order.status === 'pending' ? 'Start Preparing' : order.status === 'preparing' ? 'Mark Ready' : 'Complete';

    const doneCount = order.items.filter((i) => i.is_done).length;
    const total = order.items.length;
    const allDone = total > 0 && doneCount === total;
    const readyToServe = allDone && order.status === 'preparing';
    const summary = order.items.map((i) => `${i.quantity}× ${i.menu_item.name}${i.variation ? ` (${i.variation.name})` : ''}`).join(', ');

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="rounded-2xl p-4"
            style={{
                background: 'var(--k-card)',
                border: `2px solid ${config.border}`,
                boxShadow: `0 0 20px ${config.glow}`,
                opacity: dragging ? 0.35 : 1,
            }}
        >
            <div className="flex items-start gap-1">
            {/* Drag handle — hold and drag this card into another column to change its status */}
            <button
                type="button"
                onPointerDown={(e) => onDragStart(order, e)}
                aria-label={`Drag order ${order.order_number} to another column`}
                title="Drag to another column"
                className="-ml-2 flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[var(--k-subtle)] transition-colors hover:text-[var(--k-text)] active:cursor-grabbing"
            >
                <GripVertical className="h-5 w-5" />
            </button>

            {/* Card Header — tap to collapse / expand */}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} order ${order.order_number}`}
                className="flex min-w-0 flex-1 items-start justify-between text-left"
            >
                <div>
                    <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace", fontSize: '22px', color: config.color }}>
                        {order.order_number}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--k-muted)]">
                        {order.table ? order.table.name : 'Walk-in'} •{' '}
                        <span className="capitalize">{order.type.replace('-', ' ')}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-full px-2 py-1 text-xs" style={{ background: 'var(--k-overlay)', color: 'var(--k-muted)' }}>
                        <Clock className="h-3 w-3" />
                        <span style={{ fontFamily: "'Space Mono', monospace" }}>{elapsed}</span>
                    </div>
                    <ChevronDown className="h-5 w-5 text-[var(--k-muted)] transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
                </div>
            </button>
            </div>

            {/* Progress + check all (always visible) */}
            <div className="mt-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between text-xs">
                        <span style={{ color: allDone ? 'var(--k-ok)' : 'var(--k-muted)' }} className="font-semibold">
                            {allDone ? 'All items done' : `${doneCount} of ${total} done`}
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--k-overlay-strong)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${total ? (doneCount / total) * 100 : 0}%`, background: allDone ? 'var(--k-ok)' : config.color }} />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onCheckAll(order.id, !allDone)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                    style={allDone
                        ? { background: 'var(--k-overlay)', color: 'var(--k-muted)' }
                        : { background: 'var(--k-ok-bg)', color: 'var(--k-ok)' }}
                >
                    {allDone ? <><Undo2 className="h-4 w-4" /> Uncheck all</> : <><CheckCheck className="h-4 w-4" /> Check all</>}
                </button>
            </div>

            {order.notes && (
                <p className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold italic" style={{ background: 'var(--k-overlay)', color: 'var(--k-warn)' }}>
                    ⚠ Order note: {order.notes}
                </p>
            )}

            {/* Items */}
            {expanded ? (
                <div className="mt-3 space-y-2">
                    {order.items.map((item) => {
                        const done = !!item.is_done;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="checkbox"
                                aria-checked={done}
                                onClick={() => onToggleItem(order.id, item.id, !done)}
                                className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors"
                                style={{ background: done ? 'var(--k-done-bg)' : 'var(--k-overlay)', minHeight: 48 }}
                            >
                                <span
                                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors"
                                    style={done ? { background: '#22C55E', borderColor: '#22C55E' } : { borderColor: 'var(--k-check)' }}
                                >
                                    {done && <Check className="h-5 w-5" style={{ color: '#111' }} strokeWidth={3} />}
                                </span>
                                <span className="min-w-0 flex-1" style={{ opacity: done ? 0.55 : 1 }}>
                                    <span className="block font-semibold text-[var(--k-text)]" style={{ textDecoration: done ? 'line-through' : 'none' }}>
                                        <span style={{ color: config.color }}>{item.quantity}×</span> {item.menu_item.name}
                                        {item.variation && <span className="ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: config.color, color: config.on, textDecoration: 'none' }}>{item.variation.name}</span>}
                                    </span>
                                    {item.addons.length > 0 && (
                                        <span className="mt-0.5 block text-xs text-[var(--k-muted)]">
                                            {item.addons.map((a) => a.name).join(' · ')}
                                        </span>
                                    )}
                                    {item.notes && (
                                        <span className="mt-0.5 block text-xs italic" style={{ color: 'var(--k-warn)' }}>
                                            ⚠ {item.notes}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <p className="mt-3 line-clamp-2 text-sm text-[var(--k-muted)]">{summary}</p>
            )}

            {/* Action Button */}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
                <button
                    onClick={() => !updating && onUpdateStatus(order.id, nextStatus)}
                    disabled={updating}
                    className={`mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition-all ${readyToServe && !updating ? 'animate-pulse' : ''}`}
                    style={{
                        background: updating ? 'var(--k-overlay-strong)' : config.color,
                        color: updating ? 'var(--k-subtle)' : config.on,
                        cursor: updating ? 'not-allowed' : 'pointer',
                    }}
                >
                    {updating ? '...' : readyToServe ? '✓ All done — Mark Ready' : nextLabel}
                </button>
            )}
        </motion.div>
    );
}

/** The spoken announcement for a new order, e.g. "New order alert! 2 Burger, 3 Fries. Please take note: no onions." */
function buildAnnouncement(order: Order): string {
    const items = order.items.map((item) => `${item.quantity} ${item.menu_item.name}${item.variation ? ` ${item.variation.name}` : ''}`).join(', ');
    const notes = [order.notes, ...order.items.map((item) => (item.notes ? `${item.menu_item.name}: ${item.notes}` : null))].filter(Boolean);

    return `New order alert! ${items}.${notes.length > 0 ? ` Please take note: ${notes.join('. ')}.` : ''}`;
}

const ANNOUNCEMENT_RATE = 0.7;
const ANNOUNCEMENT_REPEAT_DELAY_MS = 5000;

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
const socketId = () => window.Echo?.socketId() ?? '';

export default function KitchenDisplay({ station, initialOrders }: Props) {
    const stationLabel = station === 'kitchen' ? 'Kitchen' : 'Barista';
    // Light by default; the choice is remembered for the Kitchen and Barista screens only.
    const [theme, setTheme] = useState<Theme>(readStoredTheme);

    function toggleTheme() {
        const next: Theme = theme === 'light' ? 'dark' : 'light';
        setTheme(next);

        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // Storage can be blocked (private mode); the toggle still works for this visit.
        }
    }

    const [orders, setOrders] = useState<Order[]>(() => sortOrdersFifo(initialOrders.map((o) => forStation(o, station)).filter((o): o is Order => o !== null)));
    const ordersRef = useRef(orders);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);
    const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const repeatTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        const timers = repeatTimers.current;

        return () => {
            timers.forEach(clearTimeout);
            window.speechSynthesis?.cancel();
        };
    }, []);

    const announceOrder = useCallback(
        (order: Order) => {
            if (!soundEnabled || !('speechSynthesis' in window)) {
                return;
            }

            const message = buildAnnouncement(order);

            const speak = (onEnd?: () => void) => {
                const utterance = new SpeechSynthesisUtterance(message);
                utterance.lang = 'en-US';
                utterance.rate = ANNOUNCEMENT_RATE;
                utterance.onend = () => onEnd?.();
                window.speechSynthesis.speak(utterance);
            };

            // Said twice, with a pause in between, so the kitchen staff can catch it over the noise.
            speak(() => {
                const timer = setTimeout(() => speak(), ANNOUNCEMENT_REPEAT_DELAY_MS);
                repeatTimers.current.push(timer);
            });
        },
        [soundEnabled],
    );

    // Browsers only allow sound and speech after the screen has been touched; until then the banner asks for a tap.
    const [audioLocked, setAudioLocked] = useState(true);

    const unlockAudio = useCallback(() => {
        try {
            audioContextRef.current ??= new AudioContext();
            void audioContextRef.current.resume().then(() => setAudioLocked(audioContextRef.current?.state !== 'running'));

            if ('speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
            }
        } catch {
            // Audio is unavailable on this device.
        }
    }, []);

    useEffect(() => {
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
        };
    }, [unlockAudio]);

    const playChime = useCallback(
        (type: 'new' | 'ready') => {
            if (!soundEnabled) {
return;
}

            try {
                const ctx = audioContextRef.current ?? new AudioContext();
                audioContextRef.current = ctx;
                void ctx.resume();
                // A new order rings three times so it cannot be missed over the noise of the bar; "ready" is a single ding.
                const beeps = type === 'new' ? [0, 0.45, 0.9] : [0];

                beeps.forEach((offset) => {
                    const start = ctx.currentTime + offset;
                    const oscillator = ctx.createOscillator();
                    const gain = ctx.createGain();
                    oscillator.type = 'triangle';
                    oscillator.connect(gain);
                    gain.connect(ctx.destination);
                    oscillator.frequency.setValueAtTime(type === 'new' ? 880 : 1320, start);
                    oscillator.frequency.exponentialRampToValueAtTime(type === 'new' ? 1100 : 1760, start + 0.15);
                    gain.gain.setValueAtTime(0.8, start);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
                    oscillator.start(start);
                    oscillator.stop(start + 0.4);
                });
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
        if (!window.Echo) {
return;
}

        window.Echo.channel('kitchen')
            .listen('.order.placed', (e: { order: Order }) => {
                const kitchenOrder = forStation(e.order, station);

                if (!kitchenOrder) {
                    return;
                }

                if (station === 'kitchen') {
                    announceOrder(kitchenOrder);
                } else {
                    playChime('new');
                }

                setOrders((prev) => {
                    if (prev.some((o) => o.id === kitchenOrder.id)) {
                        return prev;
                    }

                    return sortOrdersFifo([...prev, kitchenOrder]);
                });
            })
            .listen('.status.updated', (e: { order: Order }) => {
                const kitchenOrder = forStation(e.order, station);

                if (!kitchenOrder) {
                    setOrders((prev) => prev.filter((o) => o.id !== e.order.id));

                    return;
                }

                if (kitchenOrder.status === 'ready' && ordersRef.current.find((o) => o.id === e.order.id)?.status !== 'ready') {
playChime('ready');
}

                if (e.order.status === 'completed' || e.order.status === 'cancelled' || e.order.status === 'voided') {
                    setOrders((prev) => prev.filter((o) => o.id !== e.order.id));
                } else {
                    setOrders((prev) => sortOrdersFifo(prev.map((o) => (o.id === e.order.id ? kitchenOrder : o))));
                }
            });

        return () => {
            window.Echo?.leaveChannel('kitchen');
        };
    }, [announceOrder, playChime, station]);

    async function handleUpdateStatus(orderId: number, status: string) {
        setUpdatingIds((prev) => new Set(prev).add(orderId));

        try {
            const res = await fetch(stationOrdersUpdateStatus(station, orderId), {
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
                const kitchenOrder = forStation(data.order, station);

                setOrders((prev) => kitchenOrder
                    ? sortOrdersFifo(prev.map((o) => (o.id === orderId ? kitchenOrder : o)))
                    : prev.filter((o) => o.id !== orderId));
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

    type ColumnStatus = 'pending' | 'preparing' | 'ready';

    const [drag, setDrag] = useState<{ order: Order; x: number; y: number } | null>(null);
    const [overColumn, setOverColumn] = useState<ColumnStatus | null>(null);

    const columnAt = (x: number, y: number): ColumnStatus | null =>
        (document.elementFromPoint(x, y)?.closest('[data-column]') as HTMLElement | null)?.dataset.column as ColumnStatus | null ?? null;

    /** Pointer-based drag so it works with mouse and touch, and the card is never clipped by a scrolling column. */
    function startDrag(order: Order, event: React.PointerEvent) {
        if (event.button !== 0 || updatingIds.has(order.id)) {
            return;
        }

        event.preventDefault();
        setDrag({ order, x: event.clientX, y: event.clientY });
        document.body.style.userSelect = 'none';

        const onMove = (e: PointerEvent) => {
            setDrag({ order, x: e.clientX, y: e.clientY });
            setOverColumn(columnAt(e.clientX, e.clientY));
        };

        const finish = (e: PointerEvent | KeyboardEvent, drop: boolean) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);
            document.body.style.userSelect = '';

            const target = drop && 'clientX' in e ? columnAt(e.clientX, e.clientY) : null;
            setDrag(null);
            setOverColumn(null);

            if (target && target !== order.status) {
                handleUpdateStatus(order.id, target);
            }
        };

        const onUp = (e: PointerEvent) => finish(e, true);
        const onCancel = (e: PointerEvent) => finish(e, false);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish(e, false);

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('keydown', onKey);
    }

    function showError(message: string) {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 4000);
    }

    /** Optimistically tick items, then reconcile with the server (rolling back if the request fails). */
    async function syncItems(orderId: number, url: string, method: 'PATCH' | 'POST', body: { done: boolean }, apply: (o: Order) => Order) {
        const snapshot = ordersRef.current;
        setOrders((prev) => prev.map((o) => (o.id === orderId ? apply(o) : o)));

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);

                throw new Error(data?.message ?? 'Could not save. Please try again.');
            }

            const data: { order?: Order } = await res.json();
            const kitchenOrder = data.order ? forStation(data.order, station) : null;

            setOrders((prev) => (kitchenOrder ? sortOrdersFifo(prev.map((o) => (o.id === orderId ? kitchenOrder : o))) : prev.filter((o) => o.id !== orderId)));
        } catch (err) {
            setOrders(snapshot);
            showError(err instanceof Error ? err.message : 'Could not save. Please try again.');
        }
    }

    const startIfPending = (o: Order, done: boolean): Order['status'] => (done && o.status === 'pending' ? 'preparing' : o.status);

    function handleToggleItem(orderId: number, itemId: number, done: boolean) {
        syncItems(orderId, stationOrderItemsToggle(station, itemId), 'PATCH', { done }, (o) => ({
            ...o,
            status: startIfPending(o, done),
            items: o.items.map((i) => (i.id === itemId ? { ...i, is_done: done } : i)),
        }));
    }

    function handleCheckAll(orderId: number, done: boolean) {
        syncItems(orderId, stationOrdersCheckAll(station, orderId), 'POST', { done }, (o) => ({
            ...o,
            status: startIfPending(o, done),
            items: o.items.map((i) => ({ ...i, is_done: done })),
        }));
    }

    const pendingOrders = sortOrdersFifo(orders.filter((o) => o.status === 'pending'));
    const preparingOrders = sortOrdersFifo(orders.filter((o) => o.status === 'preparing'));
    const readyOrders = sortOrdersFifo(orders.filter((o) => o.status === 'ready'));

    return (
        <ThemeContext.Provider value={theme}>
        <div className="h-screen overflow-hidden" style={{ ...THEME_VARS[theme], background: 'var(--k-bg)', color: 'var(--k-text)', fontFamily: "'DM Sans', sans-serif" }}>
            <Head title={stationLabel} />

            {errorMessage && (
                <div role="alert" className="fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg" style={{ background: '#7F1D1D', color: '#FEE2E2' }}>
                    {errorMessage}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3" style={{ background: 'var(--k-header)', borderBottom: '1px solid var(--k-line)' }}>
                <div className="flex items-center gap-3">
                    <a
                        href="/admin"
                        className="flex items-center justify-center rounded-full transition-colors"
                        style={{ width: 32, height: 32, background: 'rgba(117,146,255,0.15)' }}
                        title="Back to Dashboard"
                    >
                        <LayoutDashboard className="h-4 w-4" style={{ color: '#7592FF' }} />
                    </a>
                    <span style={{ color: '#7592FF', fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 700 }}>
                        Milk&Honey — {stationLabel}
                    </span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex gap-4 text-sm">
                        <span style={{ color: statusConfig(theme, 'pending').color }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{pendingOrders.length}</span>
                            <span className="ml-1 text-[var(--k-muted)]">Pending</span>
                        </span>
                        <span style={{ color: statusConfig(theme, 'preparing').color }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{preparingOrders.length}</span>
                            <span className="ml-1 text-[var(--k-muted)]">Preparing</span>
                        </span>
                        <span style={{ color: statusConfig(theme, 'ready').color }}>
                            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{readyOrders.length}</span>
                            <span className="ml-1 text-[var(--k-muted)]">Ready</span>
                        </span>
                    </div>
                    <button
                        onClick={toggleTheme}
                        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
                        className="rounded-full p-2 transition-colors"
                        style={{ background: 'var(--k-overlay)' }}
                    >
                        {theme === 'light' ? <Moon className="h-5 w-5" style={{ color: 'var(--k-muted)' }} /> : <Sun className="h-5 w-5" style={{ color: '#F59E0B' }} />}
                    </button>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="rounded-full p-2 transition-colors"
                        style={{ background: soundEnabled ? 'rgba(117,146,255,0.15)' : 'var(--k-overlay)' }}
                    >
                        {soundEnabled ? (
                            <Bell className="h-5 w-5" style={{ color: '#7592FF' }} />
                        ) : (
                            <BellOff className="h-5 w-5 text-[var(--k-subtle)]" />
                        )}
                    </button>
                </div>
            </div>

            {audioLocked && soundEnabled && (
                <button
                    type="button"
                    onClick={unlockAudio}
                    className="w-full bg-amber-500 py-2 text-center text-sm font-bold text-black"
                >
                    🔔 Tap here to turn on order alerts — the browser keeps sound off until the screen is touched
                </button>
            )}

            {/* Kanban Board */}
            <div className="grid h-[calc(100vh-56px)] grid-cols-3 gap-0">
                {(
                    [
                        { status: 'pending', orders: pendingOrders },
                        { status: 'preparing', orders: preparingOrders },
                        { status: 'ready', orders: readyOrders },
                    ] as const
                ).map(({ status, orders: columnOrders }) => {
                    const config = statusConfig(theme, status);

                    return (
                        <div
                            key={status}
                            data-column={status}
                            className="flex flex-col overflow-hidden transition-colors"
                            style={{
                                borderRight: '1px solid var(--k-line)',
                                background: drag && overColumn === status ? `${config.color}14` : undefined,
                                boxShadow: drag && overColumn === status ? `inset 0 0 0 2px ${config.color}` : undefined,
                            }}
                        >
                            <div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--k-overlay-faint)' }}>
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
                                            onToggleItem={handleToggleItem}
                                            onCheckAll={handleCheckAll}
                                            onDragStart={startDrag}
                                            dragging={drag?.order.id === order.id}
                                        />
                                    ))}
                                </AnimatePresence>
                                {columnOrders.length === 0 && (
                                    <div className="flex flex-col items-center justify-center pt-16 text-[var(--k-faint)]">
                                        <p className="text-4xl opacity-20">—</p>
                                        <p className="mt-2 text-sm">{drag ? `Drop here to mark ${config.label.toLowerCase()}` : 'No orders'}</p>
                                    </div>
                                )}
                                {drag && overColumn === status && drag.order.status !== status && columnOrders.length > 0 && (
                                    <div className="rounded-xl border-2 border-dashed py-4 text-center text-sm font-semibold" style={{ borderColor: config.color, color: config.color }}>
                                        Drop here to move to {config.label}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating copy of the order that follows the pointer while dragging */}
            {drag && (
                <div
                    className="pointer-events-none fixed z-[100] w-64 rounded-2xl p-4"
                    style={{
                        left: drag.x,
                        top: drag.y,
                        transform: 'translate(-50%, -24px) rotate(2deg)',
                        background: 'var(--k-card)',
                        border: `2px solid ${statusConfig(theme, drag.order.status as keyof typeof STATUS_CONFIG).border}`,
                        boxShadow: 'var(--k-shadow)',
                    }}
                >
                    <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px', color: statusConfig(theme, drag.order.status as keyof typeof STATUS_CONFIG).color }}>
                        {drag.order.order_number}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--k-muted)]">
                        {drag.order.table ? drag.order.table.name : 'Walk-in'} • {drag.order.items.length} item{drag.order.items.length === 1 ? '' : 's'}
                    </p>
                </div>
            )}
        </div>
        </ThemeContext.Provider>
    );
}
