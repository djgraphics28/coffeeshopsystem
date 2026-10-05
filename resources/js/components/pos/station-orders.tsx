import { Check, ChefHat, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order, StationStatus } from './types';

export type StationKey = 'kitchen' | 'barista';

const STATION_LABEL: Record<StationKey, string> = { kitchen: 'Kitchen', barista: 'Barista' };

const COLUMNS: Array<{ status: Exclude<StationStatus, 'completed'>; label: string; tone: string }> = [
    { status: 'pending', label: 'New', tone: 'text-warning bg-warning/10' },
    { status: 'preparing', label: 'Preparing', tone: 'text-info bg-info/10' },
    { status: 'ready', label: 'Ready', tone: 'text-success bg-success/10' },
];

export const stationStatusOf = (order: Order, station: StationKey): StationStatus | null =>
    (station === 'kitchen' ? order.kitchen_status : order.barista_status) ?? null;

/** Orders that currently have unfinished work at a station. */
export const stationOrders = (orders: Order[], station: StationKey): Order[] =>
    orders.filter((o) => {
        const status = stationStatusOf(o, station);

        return status !== null && status !== 'completed';
    });

function minutesAgo(iso: string): string {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

    return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
}

interface Props {
    station: StationKey;
    orders: Order[];
}

/** Read-only view of what a station is working on, grouped by progress, so the cashier can answer "is it ready yet?". */
export function StationOrders({ station, orders }: Props) {
    const list = stationOrders(orders, station);
    const Icon = station === 'kitchen' ? ChefHat : Coffee;

    if (list.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Icon className="mb-3 h-12 w-12 opacity-20" />
                <p className="text-sm font-medium text-foreground">Nothing in the {STATION_LABEL[station].toLowerCase()} right now</p>
                <p className="text-xs">Orders with {station === 'kitchen' ? 'kitchen' : 'barista'} items appear here as soon as they are placed.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {COLUMNS.map(({ status, label, tone }) => {
                const group = list.filter((o) => stationStatusOf(o, station) === status);

                if (group.length === 0) {
                    return null;
                }

                return (
                    <section key={status} aria-label={`${STATION_LABEL[station]} — ${label}`}>
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', tone)}>{label}</span>
                            <span className="text-muted-foreground">{group.length} order{group.length === 1 ? '' : 's'}</span>
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {group.map((order) => {
                                const items = order.items.filter((i) => (i.menu_item.is_kitchen !== false) === (station === 'kitchen'));
                                const done = items.filter((i) => i.is_done).length;

                                return (
                                    <article key={order.id} className="rounded-xl border border-[var(--ap-border)] bg-card p-3 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-foreground" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{order.order_number}</p>
                                                <p className="text-xs text-muted-foreground">{order.table?.name ?? 'Walk-in'} · {minutesAgo(order.created_at)}</p>
                                            </div>
                                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', order.payment ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                                                {order.payment ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </div>

                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
                                            </div>
                                            <span className="text-[11px] whitespace-nowrap text-muted-foreground">{done}/{items.length} done</span>
                                        </div>

                                        <ul className="mt-2 space-y-1">
                                            {items.map((item) => (
                                                <li key={item.id} className="flex items-start gap-2 text-sm">
                                                    <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', item.is_done ? 'border-success bg-success text-white' : 'border-[var(--ap-border)]')}>
                                                        {item.is_done && <Check className="h-3 w-3" strokeWidth={3} />}
                                                    </span>
                                                    <span className={cn('min-w-0', item.is_done && 'text-muted-foreground line-through')}>
                                                        {item.quantity}× {item.menu_item.name}
                                                        {item.variation && <span className="ml-1 rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary no-underline">{item.variation.name}</span>}
                                                        {item.addons.length > 0 && <span className="block text-[11px] text-muted-foreground">{item.addons.map((a) => a.name).join(' · ')}</span>}
                                                        {item.notes && <span className="block text-[11px] text-warning italic">⚠ {item.notes}</span>}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
