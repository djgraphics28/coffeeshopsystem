import { Link } from '@inertiajs/react';
import { AlarmClock, Bell, BellRing, Globe, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { enableAlerts, startOnlineOrderAlerts, useOnlineOrderAlerts } from '@/lib/online-order-alerts';
import type { WaitingOrder } from '@/lib/online-order-alerts';
import { adminOnlineOrdersIndex } from '@/lib/routes';

function waitedFor(order: WaitingOrder): string {
    const minutes = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000);

    return minutes < 1 ? 'just now' : `${minutes} min ago`;
}

function announce(order: WaitingOrder) {
    toast(
        () => (
            <span className="text-sm">
                🛎️ <strong>New online order #{order.order_number}</strong>
                <br />
                {order.customer ?? 'A customer'} · {order.type} — accept it in Online Orders
            </span>
        ),
        { duration: 8000 },
    );
}

/** Top-bar bell: live count of online orders waiting to be accepted, with a quick list. */
export function OnlineOrderBell() {
    const { waiting, overdue, permission, soundReady } = useOnlineOrderAlerts();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        startOnlineOrderAlerts(announce);
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        const close = (event: MouseEvent) => {
            if (!ref.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', close);

        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const count = waiting.length;
    const alertsOff = permission !== 'granted' || !soundReady;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={count ? `${count} online orders waiting` : 'Notifications'}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-muted"
            >
                {count > 0 ? <BellRing className={`h-5 w-5 ${overdue.length ? 'animate-bounce text-error' : 'text-primary'}`} /> : <Bell className="h-5 w-5 text-muted-foreground" />}
                {count > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${overdue.length ? 'bg-error' : 'bg-primary'}`}>
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">Online orders waiting</p>
                        <span className="text-xs text-muted-foreground">{count}</span>
                    </div>
                    {count === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No orders waiting. 🎉</p>
                    ) : (
                        <ul className="max-h-72 overflow-y-auto">
                            {waiting.map((order) => {
                                const late = overdue.some((o) => o.id === order.id);

                                return (
                                    <li key={order.id}>
                                        <Link href={adminOnlineOrdersIndex()} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground">#{order.order_number}</p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {order.customer ?? 'Customer'} · {order.type}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 text-xs font-medium ${late ? 'text-error' : 'text-muted-foreground'}`}>{waitedFor(order)}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {alertsOff && (
                        <button
                            type="button"
                            onClick={() => void enableAlerts()}
                            className="flex w-full items-center justify-center gap-2 border-t border-border bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10"
                        >
                            <Volume2 className="h-4 w-4" /> Turn on sound &amp; desktop alerts
                        </button>
                    )}
                    <Link href={adminOnlineOrdersIndex()} onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted">
                        <Globe className="h-4 w-4" /> Open Online Orders
                    </Link>
                </div>
            )}
        </div>
    );
}

/** Red banner on every admin page while an online order has waited past the reminder window. */
export function OnlineOrderOverdueBanner() {
    const { overdue, reminderMinutes } = useOnlineOrderAlerts();

    if (overdue.length === 0) {
        return null;
    }

    const oldest = overdue[0];

    return (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
                <AlarmClock className="h-5 w-5 shrink-0 animate-pulse text-error" />
                <p className="text-sm text-foreground">
                    <strong>
                        {overdue.length === 1 ? `Online order #${oldest.order_number}` : `${overdue.length} online orders`} waiting over {reminderMinutes} minutes.
                    </strong>{' '}
                    The customer is waiting for you to accept.
                </p>
            </div>
            <Link href={adminOnlineOrdersIndex()} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90">
                Review now
            </Link>
        </div>
    );
}
