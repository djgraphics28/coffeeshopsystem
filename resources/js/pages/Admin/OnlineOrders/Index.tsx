import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { AlarmClock, Bike, Check, CheckCircle2, Clock, ExternalLink, Globe, MapPin, Phone, ShoppingBag, Store, UtensilsCrossed, Volume2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { enableAlerts, refreshOnlineOrderAlerts, useOnlineOrderAlerts } from '@/lib/online-order-alerts';
import { adminOnlineOrdersAccept, adminOnlineOrdersDecline, adminOrdersShow } from '@/lib/routes';

interface OnlineOrder {
    id: number;
    order_number: string;
    status: string;
    type: 'pickup' | 'delivery' | 'dine-in' | 'takeout';
    total: number;
    notes: string | null;
    payment_method: 'cod' | 'gcash' | 'maya' | null;
    payment_proof_url: string | null;
    delivery_address: string | null;
    delivery_lat: number | null;
    delivery_lng: number | null;
    accepted_at: string | null;
    accepted_by?: string | null;
    decline_reason: string | null;
    created_at: string;
    updated_at: string;
    table: { id: number | null; name: string | null } | null;
    customer: { id: number; name: string; phone: string | null; email: string } | null;
    items: { id: number; quantity: number; menu_item: { name: string | null }; variation: { name: string } | null; addons: { name: string | null }[]; notes: string | null }[];
}

interface Props {
    waiting: OnlineOrder[];
    inProgress: OnlineOrder[];
    recent: OnlineOrder[];
    reminderMinutes: number;
}

const TYPE_META: Record<OnlineOrder['type'], { label: string; icon: typeof Store }> = {
    pickup: { label: 'Pickup', icon: Store },
    delivery: { label: 'Delivery', icon: Bike },
    'dine-in': { label: 'Dine-in', icon: UtensilsCrossed },
    takeout: { label: 'Take-out', icon: ShoppingBag },
};

const PAYMENT_LABELS: Record<string, string> = { cod: 'Cash', gcash: 'GCash', maya: 'Maya' };

const DECLINE_REASONS = ['An item is unavailable', 'We are too busy right now', 'Outside our delivery area', 'Payment was not received', 'The café is closing'];

function money(value: number) {
    return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function timeOf(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Re-renders every second for live waiting timers. */
function useNow(): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(timer);
    }, []);

    return now;
}

export default function OnlineOrdersIndex({ waiting, inProgress, recent, reminderMinutes }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const { permission, soundReady } = useOnlineOrderAlerts();
    const [busyId, setBusyId] = useState<number | null>(null);
    const [declining, setDeclining] = useState<OnlineOrder | null>(null);
    const [reason, setReason] = useState('');
    const now = useNow();

    // Keep the lists fresh even without realtime.
    usePoll(10_000, { only: ['waiting', 'inProgress', 'recent'] });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }

        if (flash?.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    function accept(order: OnlineOrder) {
        setBusyId(order.id);
        router.post(adminOnlineOrdersAccept(order.id), {}, { preserveScroll: true, onFinish: () => {
 setBusyId(null); refreshOnlineOrderAlerts(); 
} });
    }

    function decline(e: React.FormEvent) {
        e.preventDefault();

        if (!declining) {
            return;
        }

        setBusyId(declining.id);
        router.post(adminOnlineOrdersDecline(declining.id), { reason }, {
            preserveScroll: true,
            onSuccess: () => {
 setDeclining(null); setReason(''); 
},
            onFinish: () => {
 setBusyId(null); refreshOnlineOrderAlerts(); 
},
        });
    }

    const alertsOn = permission === 'granted' && soundReady;

    return (
        <AdminLayout>
            <Head title="Online Orders" />
            <Toaster position="top-right" />

            <PageHeader
                title="Online Orders"
                breadcrumbs={[{ label: 'Online Orders' }]}
                actions={
                    !alertsOn && (
                        <Button variant="outline" onClick={() => void enableAlerts()}>
                            <Volume2 className="h-4 w-4" /> Turn on sound &amp; desktop alerts
                        </Button>
                    )
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">
                Orders from the online storefront. Accept them to send them to the kitchen and barista — you&apos;ll be reminded if one waits more than {reminderMinutes} minutes.
            </p>

            {/* Waiting for acceptance */}
            <section className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                    <AlarmClock className="h-5 w-5 text-primary" /> Waiting for acceptance
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{waiting.length}</span>
                </h2>

                {waiting.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                        <p className="mt-3 font-semibold text-foreground">All caught up</p>
                        <p className="mt-1 text-sm text-muted-foreground">New online orders will appear here with a sound alert.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {waiting.map((order) => {
                            const seconds = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 1000));
                            const minutes = Math.floor(seconds / 60);
                            const overdue = minutes >= reminderMinutes;
                            const warning = !overdue && minutes >= reminderMinutes - 2;
                            const type = TYPE_META[order.type] ?? TYPE_META.pickup;
                            const TypeIcon = type.icon;

                            return (
                                <article
                                    key={order.id}
                                    className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm ${overdue ? 'border-error' : warning ? 'border-warning' : 'border-primary/40'}`}
                                >
                                    <header className={`flex items-center justify-between gap-3 px-4 py-3 ${overdue ? 'bg-error/10' : warning ? 'bg-warning/10' : 'bg-primary/5'}`}>
                                        <div>
                                            <p className="font-mono text-sm font-bold text-foreground">#{order.order_number}</p>
                                            <p className="text-xs text-muted-foreground">Placed {timeOf(order.created_at)}</p>
                                        </div>
                                        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${overdue ? 'animate-pulse bg-error text-white' : warning ? 'bg-warning text-white' : 'bg-card text-foreground'}`}>
                                            <Clock className="h-4 w-4" />
                                            {minutes}:{String(seconds % 60).padStart(2, '0')}
                                            {overdue && <span className="ml-1 text-xs">overdue</span>}
                                        </div>
                                    </header>

                                    <div className="flex-1 space-y-3 p-4 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="default" className="gap-1"><TypeIcon className="h-3.5 w-3.5" /> {type.label}{order.table?.name ? ` · ${order.table.name}` : ''}</Badge>
                                            {order.payment_method && <Badge variant="neutral">{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</Badge>}
                                            <span className="ml-auto text-base font-bold text-foreground">{money(order.total)}</span>
                                        </div>

                                        {order.customer && (
                                            <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2">
                                                <span className="font-medium text-foreground">{order.customer.name}</span>
                                                {order.customer.phone && (
                                                    <a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                                        <Phone className="h-3.5 w-3.5" /> {order.customer.phone}
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        <ul className="space-y-1">
                                            {order.items.map((item) => (
                                                <li key={item.id} className="text-foreground">
                                                    <span className="font-semibold text-primary">{item.quantity}×</span> {item.menu_item.name}
                                                    {(item.variation || item.addons.length > 0 || item.notes) && (
                                                        <span className="block pl-5 text-xs text-muted-foreground">
                                                            {[item.variation?.name, ...item.addons.map((a) => a.name), item.notes && `“${item.notes}”`].filter(Boolean).join(' · ')}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>

                                        {order.type === 'delivery' && order.delivery_address && (
                                            <a
                                                href={order.delivery_lat ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-start gap-1.5 rounded-xl bg-muted/40 px-3 py-2 text-xs text-foreground hover:bg-muted"
                                            >
                                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {order.delivery_address}
                                            </a>
                                        )}

                                        {order.notes && <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-foreground">📝 {order.notes}</p>}

                                        {order.payment_proof_url && (
                                            <a href={order.payment_proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border p-2 hover:border-primary">
                                                <img src={order.payment_proof_url} alt="Payment proof" className="h-14 w-14 rounded-lg object-cover" />
                                                <span className="text-xs text-foreground">
                                                    <strong>Check the payment proof</strong>
                                                    <br />
                                                    <span className="text-muted-foreground">Open full size</span>
                                                </span>
                                            </a>
                                        )}
                                    </div>

                                    <footer className="flex gap-2 border-t border-border p-3">
                                        <Button className="flex-1" onClick={() => accept(order)} disabled={busyId === order.id}>
                                            <Check className="h-4 w-4" /> {busyId === order.id ? 'Accepting…' : 'Accept'}
                                        </Button>
                                        <Button variant="outline" className="text-error" onClick={() => {
 setDeclining(order); setReason(''); 
}} disabled={busyId === order.id}>
                                            <X className="h-4 w-4" /> Decline
                                        </Button>
                                    </footer>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Accepted, being prepared */}
            <OrderList title="In progress" icon={Globe} orders={inProgress} empty="No accepted online orders in progress." />

            {/* Finished today */}
            <OrderList title="Finished today" icon={CheckCircle2} orders={recent} empty="Nothing finished yet today." />

            <CrudModal
                open={!!declining}
                onOpenChange={(open) => !open && setDeclining(null)}
                title={declining ? `Decline order #${declining.order_number}?` : 'Decline order'}
                description="The customer sees this reason on their order page. Any points or free drinks they used are refunded."
                footer={
                    <Button type="submit" form="decline-form" variant="destructive" disabled={!reason.trim() || busyId === declining?.id}>
                        Decline order
                    </Button>
                }
            >
                <form id="decline-form" onSubmit={decline} className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {DECLINE_REASONS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setReason(preset)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${reason === preset ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                    <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the customer" maxLength={255} className={adminFieldClass() + ' resize-none'} />
                </form>
            </CrudModal>
        </AdminLayout>
    );
}

const STATUS_VARIANTS: Record<string, 'warning' | 'default' | 'success' | 'neutral' | 'error'> = {
    pending: 'warning',
    preparing: 'default',
    ready: 'success',
    completed: 'neutral',
    cancelled: 'error',
    voided: 'error',
};

function OrderList({ title, icon: Icon, orders, empty }: { title: string; icon: typeof Globe; orders: OnlineOrder[]; empty: string }) {
    return (
        <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                <Icon className="h-5 w-5 text-muted-foreground" /> {title}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{orders.length}</span>
            </h2>
            {orders.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <ul className="divide-y divide-border">
                        {orders.map((order) => (
                            <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                                <span className="font-mono font-bold text-foreground">#{order.order_number}</span>
                                <span className="text-foreground">{order.customer?.name ?? 'Customer'}</span>
                                <span className="text-xs text-muted-foreground">{TYPE_META[order.type]?.label ?? order.type}</span>
                                <Badge variant={STATUS_VARIANTS[order.status] ?? 'neutral'} className="capitalize">{order.status === 'cancelled' && order.decline_reason ? 'declined' : order.status}</Badge>
                                {order.accepted_by && <span className="text-xs text-muted-foreground">accepted by {order.accepted_by} at {order.accepted_at && timeOf(order.accepted_at)}</span>}
                                {order.decline_reason && <span className="text-xs text-error">“{order.decline_reason}”</span>}
                                <span className="ml-auto font-semibold text-foreground">{money(order.total)}</span>
                                <Link href={adminOrdersShow(order.id)} className="text-muted-foreground hover:text-primary" aria-label="Open order">
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
