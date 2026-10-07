import { AnimatePresence, motion } from 'framer-motion';
import { Ban, BellRing, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Order } from './types';
import { formatMoney } from './utils';

// Each action takes the colour of the status it moves the order into, so Pay (primary) never looks like an order step.
const NEXT_STATUS: Record<string, { status: string; label: string; className: string }> = {
    pending: { status: 'preparing', label: 'Start Preparing', className: 'bg-info text-info-foreground hover:bg-info/90' },
    preparing: { status: 'ready', label: 'Mark Ready', className: 'bg-success text-success-foreground hover:bg-success/90' },
    ready: { status: 'completed', label: 'Complete', className: 'bg-foreground text-background hover:bg-foreground/90' },
};

const STATUS_CLASS: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    preparing: 'bg-info/10 text-info',
    ready: 'bg-success/10 text-success',
};

function minutesAgo(iso: string): string {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

    return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
}

interface Props {
    orders: Order[];
    currency: string;
    expanded: boolean;
    onToggle: () => void;
    onAdvance: (order: Order, status: string) => void;
    onPay: (order: Order) => void;
    onVoid: (order: Order) => void;
}

export function ActiveOrders({ orders, currency, expanded, onToggle, onAdvance, onPay, onVoid }: Props) {
    return (
        <div className="shrink-0 border-t border-[var(--ap-border)] bg-card">
            <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-2.5 text-left" aria-expanded={expanded}>
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    Active Orders {orders.length > 0 && <Badge>{orders.length}</Badge>}
                </span>
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="flex gap-3 overflow-x-auto px-3 pb-3">
                            {orders.length === 0 ? (
                                <p className="py-3 text-xs text-muted-foreground">No active orders right now.</p>
                            ) : orders.map((order) => {
                                // Completing an unpaid order would close it before payment, so payment is the only way to finish it.
                                const next = NEXT_STATUS[order.status]?.status === 'completed' && !order.payment ? undefined : NEXT_STATUS[order.status];

                                return (
                                    <div key={order.id} className="w-56 shrink-0 rounded-xl border border-[var(--ap-border)] bg-[var(--ap-bg)] p-3 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-bold text-foreground" style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</p>
                                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium capitalize', STATUS_CLASS[order.status] ?? 'bg-muted text-muted-foreground')}>{order.status}</span>
                                        </div>
                                        {order.buzzer_number && (
                                            <p className={cn('mt-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold', order.status === 'ready' ? 'animate-pulse bg-success text-success-foreground' : 'bg-primary/10 text-primary')}>
                                                <BellRing className="h-3.5 w-3.5" /> Buzzer #{order.buzzer_number}{order.status === 'ready' && ' — press it now'}
                                            </p>
                                        )}
                                        <p className="mt-1 text-muted-foreground">
                                            {order.table?.name ?? 'Walk-in'} · {order.items.reduce((n, i) => n + i.quantity, 0)} items · {minutesAgo(order.created_at)}
                                        </p>
                                        {(order.kitchen_status || order.barista_status) && (
                                            <p className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold">
                                                {([['Kitchen', order.kitchen_status], ['Barista', order.barista_status]] as const).map(([label, status]) => status && (
                                                    <span key={label} className={cn('rounded-full px-1.5 py-0.5 capitalize', STATUS_CLASS[status] ?? 'bg-muted text-muted-foreground')}>{label}: {status === 'completed' ? 'served' : status}</span>
                                                ))}
                                            </p>
                                        )}
                                        <p className="mt-0.5 flex items-center justify-between">
                                            <span className="text-sm font-bold text-foreground">{formatMoney(currency, order.total)}</span>
                                            <span className={cn('font-semibold', order.payment ? 'text-success' : 'text-warning')}>{order.payment ? 'Paid' : 'Unpaid'}</span>
                                        </p>
                                        <div className="mt-2 flex gap-1.5">
                                            {!order.payment && <Button size="sm" className="h-9 flex-1" onClick={() => onPay(order)}>Pay</Button>}
                                            {next && (
                                                <Button size="sm" className={cn('h-9 flex-1', next.className)} onClick={() => onAdvance(order, next.status)}>
                                                    {next.label}
                                                </Button>
                                            )}
                                            <button onClick={() => onVoid(order)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-error/40 text-error transition-colors hover:bg-error hover:text-error-foreground" title="Void order" aria-label={`Void ${order.order_number}`}>
                                                <Ban className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
