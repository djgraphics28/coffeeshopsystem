import { Head, Link, router, useForm, usePage, usePoll } from '@inertiajs/react';
import {
    Ban, BadgeCheck, Bike, Eye, ImageIcon,
    PackageCheck, Printer, Search, ShoppingBag, TrendingUp, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FilterPanel, FilterToggleButton } from '@/components/admin/filter-panel';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Pagination } from '@/components/admin/pagination';
import { printReceipt, ThermalReceipt  } from '@/components/thermal-receipt';
import type {ReceiptOrder} from '@/components/thermal-receipt';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminOrdersAssignDeliveryMan, adminOrdersIndex, adminOrdersMarkPaid, adminOrdersShow, adminOrdersUpdateStatus, adminOrdersVoid } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    points_earned: number;
    free_drink_redeemed: boolean;
    table: { name: string } | null;
    customer: { id: number; name: string; email: string } | null;
    promo: { code: string } | null;
    items: { id: number; menu_item: { name: string }; quantity: number; subtotal: number; addons: { name: string }[] }[];
    payment: { method: string; amount: number; reference_no: string | null } | null;
    payment_method: string | null;
    payment_proof_url: string | null;
    delivery_address: string | null;
    delivery_man: { id: number; name: string } | null;
    created_at: string;
}

interface DeliveryManOption {
    id: number;
    name: string;
    vehicle: string | null;
}

interface Paginated<T> {
    data: T[];
    links: { first: string; last: string; prev: string | null; next: string | null };
    meta: {
        current_page: number;
        last_page: number;
        total: number;
        from: number;
        to: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
}

interface Stats {
    today_count: number;
    today_revenue: number;
    pending: number;
    active: number;
}

interface Props {
    orders: Paginated<Order>;
    filters: { search?: string; status?: string; date_from?: string; date_to?: string; type?: string; payment?: string };
    stats: Stats;
    delivery_men: DeliveryManOption[];
    can: { manage_orders: boolean; void_orders: boolean };
}

const ONLINE_PAYMENT_LABEL: Record<string, string> = { cod: 'COD', gcash: 'GCash', maya: 'Maya' };
const ONLINE_PAYMENT_CLASS: Record<string, string> = {
    cod: 'bg-muted text-muted-foreground',
    gcash: 'bg-info/10 text-info',
    maya: 'bg-success/10 text-success',
};

const STATUS_CLASS: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    preparing: 'bg-info/10 text-info',
    ready: 'bg-success/10 text-success',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-error/10 text-error',
    voided: 'bg-error/10 text-error',
};

const TERMINAL = ['completed', 'cancelled', 'voided'];

const currency = (n: number) => `₱${Number(n).toFixed(2)}`;

export default function OrdersIndex({ orders, filters, stats, delivery_men, can }: Props) {
    const [proofPreview, setProofPreview] = useState<Order | null>(null);
    const [codConfirm, setCodConfirm] = useState<Order | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [markingPaid, setMarkingPaid] = useState(false);

    function markPaid(order: Order, onDone?: () => void) {
        setMarkingPaid(true);
        router.post(adminOrdersMarkPaid(order.id), {}, {
            preserveScroll: true,
            onSuccess: () => onDone?.(),
            onFinish: () => setMarkingPaid(false),
        });
    }

    function quickUpdateStatus(order: Order, status: string) {
        setUpdatingId(order.id);
        router.patch(adminOrdersUpdateStatus(order.id), { status }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setUpdatingId(null),
        });
    }

    function quickAssignRider(order: Order, deliveryManId: string) {
        setUpdatingId(order.id);
        router.patch(adminOrdersAssignDeliveryMan(order.id), { delivery_man_id: deliveryManId || null }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setUpdatingId(null),
        });
    }

    // Keep the list and stat cards fresh without a manual reload (new POS / online orders).
    usePoll(20000, { only: ['orders', 'stats'] });

    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const { data, setData } = useForm({ ...filters });
    const [printingOrder, setPrintingOrder] = useState<ReceiptOrder | null>(null);
    const [voidModal, setVoidModal] = useState<Order | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const activeFilterCount = Object.values(filters).filter(Boolean).length;
    const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
    const [voiding, setVoiding] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (flash?.success) {
toast.success(flash.success);
}

        if (flash?.error) {
toast.error(flash.error);
}
    }, [flash]);

    function applyFilters(e: React.FormEvent) {
        e.preventDefault();
        const params = Object.fromEntries(Object.entries(data).filter(([, value]) => value));
        router.get(adminOrdersIndex(), params, { preserveState: true, preserveScroll: true });
    }

    function clearFilters() {
        setData({ search: '', status: '', type: '', payment: '', date_from: '', date_to: '' });
        router.get(adminOrdersIndex());
    }

    function openVoidModal(order: Order) {
        setVoidModal(order);
        setVoidReason('');
    }

    function confirmVoid() {
        if (!voidModal) {
return;
}

        setVoiding(true);
        router.post(adminOrdersVoid(voidModal.id), { void_reason: voidReason }, {
            preserveScroll: true,
            onSuccess: () => {
 setVoidModal(null); setVoiding(false); 
},
            onError: () => setVoiding(false),
        });
    }

    const statCards = [
        { label: "Today's Orders", value: stats.today_count, icon: ShoppingBag, tone: 'brand' as const },
        { label: "Today's Revenue", value: currency(stats.today_revenue), icon: TrendingUp, tone: 'success' as const },
        { label: 'Pending', value: stats.pending, icon: PackageCheck, tone: 'warning' as const },
        { label: 'Active', value: stats.active, icon: PackageCheck, tone: 'info' as const },
    ];
    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        warning: 'bg-warning/10 text-warning',
        success: 'bg-success/10 text-success',
        info: 'bg-info/10 text-info',
    };

    const hasFilters = Object.values(filters).some(Boolean);

    return (
        <AdminLayout>
            <Head title="Orders" />
            <Toaster position="top-right" />

            <PageHeader
                title="Orders"
                breadcrumbs={[{ label: 'Orders' }]}
                actions={<FilterToggleButton open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} activeCount={activeFilterCount} />}
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">
                {orders.meta.total} total · page {orders.meta.current_page} of {orders.meta.last_page}
            </p>

            {/* Stat cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statCards.map((c) => (
                    <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', toneClasses[c.tone])}>
                            <c.icon className="h-4 w-4" />
                        </div>
                        <p className="text-xl font-bold text-foreground">{c.value}</p>
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <FilterPanel open={filtersOpen} onSubmit={applyFilters}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField label="Search">
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="search"
                                value={data.search ?? ''}
                                onChange={(e) => setData('search', e.target.value)}
                                placeholder="Search orders…"
                                className={adminFieldClass() + ' pl-8'}
                            />
                        </div>
                    </FormField>
                    <FormField label="Status">
                        <select value={data.status ?? ''} onChange={(e) => setData('status', e.target.value)} className={adminFieldClass()}>
                            <option value="">All statuses</option>
                            {['pending', 'preparing', 'ready', 'completed', 'cancelled', 'voided'].map((st) => <option key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Order type">
                        <select value={data.type ?? ''} onChange={(e) => setData('type', e.target.value)} className={adminFieldClass()}>
                            <option value="">All types</option>
                            {['dine-in', 'takeout', 'walkin', 'pickup', 'delivery'].map((t) => <option key={t} value={t}>{t === 'walkin' ? 'Walk-in' : t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Payment">
                        <select value={data.payment ?? ''} onChange={(e) => setData('payment', e.target.value)} className={adminFieldClass()}>
                            <option value="">All payments</option>
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                        </select>
                    </FormField>
                    <FormField label="From date">
                        <input type="date" value={data.date_from ?? ''} max={data.date_to || undefined} onChange={(e) => setData('date_from', e.target.value)} className={adminFieldClass()} />
                    </FormField>
                    <FormField label="To date">
                        <input type="date" value={data.date_to ?? ''} min={data.date_from || undefined} onChange={(e) => setData('date_to', e.target.value)} className={adminFieldClass()} />
                    </FormField>
                    <div className="flex items-end gap-2 sm:col-span-2">
                        <Button type="submit" className="flex-1 sm:flex-none"><Search className="h-4 w-4" /> Apply filters</Button>
                        {hasFilters && <Button type="button" variant="outline" onClick={clearFilters}><X className="h-4 w-4" /> Clear</Button>}
                    </div>
                </div>
            </FilterPanel>

            {/* Table */}
            <TableCard>
                <TableScroll>
                    <Table className="min-w-[1100px]">
                        <TableHead>
                            <tr>
                                {['Order #', 'Customer / Table', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment', 'Delivery', 'Loyalty', 'Status', 'Date', ''].map((h) => (
                                    <TableHeadCell key={h}>{h}</TableHeadCell>
                                ))}
                            </tr>
                        </TableHead>
                        <TableBody>
                            {orders.data.length === 0 ? (
                                <TableEmpty colSpan={12}>No orders found</TableEmpty>
                            ) : orders.data.map((order) => {
                                const isTerminal = TERMINAL.includes(order.status);

                                return (
                                    <TableRow key={order.id} className={order.status === 'voided' ? 'opacity-60' : undefined}>
                                        <TableCell>
                                            <span className="font-mono text-xs font-bold whitespace-nowrap">{order.order_number}</span>
                                        </TableCell>
                                        <TableCell>
                                            {order.customer ? (
                                                <div>
                                                    <p className="text-xs font-medium">{order.customer.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{order.table?.name ?? order.type}</p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">{order.table?.name ?? 'Walk-in'}</p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="text-xs font-medium">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                                                <p className="max-w-[120px] truncate text-[10px] text-muted-foreground">
                                                    {order.items.map((i) => `${i.quantity}× ${i.menu_item.name}`).join(', ')}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{currency(order.subtotal)}</TableCell>
                                        <TableCell className="text-xs">
                                            {Number(order.discount) > 0 ? (
                                                <span className="text-error">-{currency(order.discount)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-bold whitespace-nowrap text-primary">{currency(order.total)}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {order.payment ? (
                                                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success capitalize">
                                                        {order.payment.method}
                                                    </span>
                                                ) : order.payment_method ? (
                                                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', ONLINE_PAYMENT_CLASS[order.payment_method])}>
                                                        {ONLINE_PAYMENT_LABEL[order.payment_method] ?? order.payment_method}
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error">Unpaid</span>
                                                )}
                                                {order.payment_proof_url && (
                                                    <button onClick={() => setProofPreview(order)} className="rounded-lg p-1 text-primary transition-colors hover:bg-muted" title="View proof of payment">
                                                        <ImageIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                {!order.payment && order.payment_method === 'cod' && can.manage_orders && !isTerminal && (
                                                    <button onClick={() => setCodConfirm(order)} className="rounded-lg p-1 text-success transition-colors hover:bg-success/10" title="Confirm cash collected">
                                                        <BadgeCheck className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {order.type === 'delivery' ? (
                                                can.manage_orders && !isTerminal ? (
                                                    <select
                                                        value={order.delivery_man ? String(order.delivery_man.id) : ''}
                                                        onChange={(e) => quickAssignRider(order, e.target.value)}
                                                        disabled={updatingId === order.id}
                                                        className={cn(
                                                            'max-w-[130px] rounded-lg border px-1.5 py-1 text-[11px] focus:outline-none disabled:opacity-50',
                                                            order.delivery_man ? 'border-[var(--ap-input-border)] bg-transparent' : 'border-warning bg-warning/10',
                                                        )}
                                                        title={order.delivery_address ?? undefined}
                                                    >
                                                        <option value="">🛵 Assign…</option>
                                                        {delivery_men.map((man) => (
                                                            <option key={man.id} value={man.id}>{man.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[11px]">
                                                        <Bike className="h-3 w-3 text-muted-foreground" />
                                                        {order.delivery_man?.name ?? '—'}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-0.5">
                                                {order.promo && (
                                                    <span className="rounded-full bg-brand-50 px-1.5 py-0.5 font-mono text-[10px] text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                                        {order.promo.code}
                                                    </span>
                                                )}
                                                {Number(order.points_earned) > 0 && (
                                                    <span className="text-[10px] text-warning">⭐{order.points_earned}</span>
                                                )}
                                                {order.free_drink_redeemed && (
                                                    <span className="text-[10px]">🎁</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {can.manage_orders && !isTerminal ? (
                                                <select
                                                    value={order.status}
                                                    onChange={(e) => quickUpdateStatus(order, e.target.value)}
                                                    disabled={updatingId === order.id}
                                                    className={cn('cursor-pointer rounded-full border-0 py-0.5 pr-6 pl-2 text-[10px] font-semibold capitalize focus:outline-none disabled:opacity-50', STATUS_CLASS[order.status])}
                                                >
                                                    {['pending', 'preparing', 'ready', 'completed', 'cancelled'].map((st) => (
                                                        <option key={st} value={st} className="capitalize">{st}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium capitalize', STATUS_CLASS[order.status])}>{order.status}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-[10px] whitespace-nowrap text-muted-foreground">
                                            {new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Link href={adminOrdersShow(order.id)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="View order">
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Link>
                                                {can.void_orders && !isTerminal && (
                                                    <button onClick={() => openVoidModal(order)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error" title="Void order">
                                                        <Ban className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => setPrintingOrder(order)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="Print receipt">
                                                    <Printer className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableScroll>
                <Pagination meta={orders.meta} />
            </TableCard>

            {/* Void modal */}
            <CrudModal
                open={!!voidModal}
                onOpenChange={(open) => !open && setVoidModal(null)}
                title="Void Order"
                description={voidModal ? <><span className="font-mono font-bold">{voidModal.order_number}</span> · {currency(voidModal.total)}</> : undefined}
                className="max-w-sm"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setVoidModal(null)}>Cancel</Button>
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
                        rows={2}
                        placeholder="e.g. Customer changed their mind, duplicate order…"
                        className={adminFieldClass() + ' resize-none'}
                    />
                </div>
            </CrudModal>

            {/* Proof of payment modal */}
            <CrudModal
                open={!!proofPreview}
                onOpenChange={(open) => !open && setProofPreview(null)}
                title="Proof of Payment"
                description={proofPreview ? <><span className="font-mono">{proofPreview.order_number}</span> · {ONLINE_PAYMENT_LABEL[proofPreview.payment_method ?? ''] ?? proofPreview.payment_method} · {currency(proofPreview.total)}</> : undefined}
                contentClassName="bg-muted/40 p-4"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setProofPreview(null)}>Close</Button>
                        <a
                            href={proofPreview?.payment_proof_url ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-1 items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                        >
                            Full Size
                        </a>
                        {proofPreview && !proofPreview.payment && can.manage_orders && !TERMINAL.includes(proofPreview.status) && (
                            <Button className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={() => markPaid(proofPreview, () => setProofPreview(null))} disabled={markingPaid}>
                                <BadgeCheck className="h-4 w-4" /> {markingPaid ? 'Saving…' : 'Approve & Mark Paid'}
                            </Button>
                        )}
                        {proofPreview?.payment && (
                            <span className="flex flex-1 items-center justify-center gap-1 rounded-md bg-success/10 py-2 text-sm font-bold text-success">
                                <BadgeCheck className="h-4 w-4" /> Verified & Paid
                            </span>
                        )}
                    </>
                }
            >
                {proofPreview && <img src={proofPreview.payment_proof_url!} alt="Proof of payment" className="w-full rounded-xl object-contain" />}
            </CrudModal>

            {/* COD confirmation modal */}
            <CrudModal
                open={!!codConfirm}
                onOpenChange={(open) => !open && setCodConfirm(null)}
                title="Confirm Cash Payment"
                className="max-w-sm"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setCodConfirm(null)}>Cancel</Button>
                        <Button
                            className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                            onClick={() => codConfirm && markPaid(codConfirm, () => setCodConfirm(null))}
                            disabled={markingPaid || (codConfirm?.type === 'delivery' && !codConfirm?.delivery_man)}
                        >
                            {markingPaid ? 'Saving…' : 'Mark as Paid'}
                        </Button>
                    </>
                }
            >
                {codConfirm && (
                    <div className="text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                            <BadgeCheck className="h-6 w-6 text-success" />
                        </div>
                        <p className="mt-3 text-sm text-foreground">
                            <span className="font-mono font-bold">{codConfirm.order_number}</span> · {currency(codConfirm.total)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {codConfirm.type === 'delivery'
                                ? codConfirm.delivery_man
                                    ? `Rider ${codConfirm.delivery_man.name} has verified and collected the cash on delivery.`
                                    : '⚠️ No delivery man assigned yet. Assign a rider first — the rider verifies the cash payment on handoff.'
                                : 'Cash was collected from the customer at the counter.'}
                        </p>
                    </div>
                )}
            </CrudModal>

            {/* Receipt modal */}
            <CrudModal
                open={!!printingOrder}
                onOpenChange={(open) => !open && setPrintingOrder(null)}
                title={printingOrder ? `Receipt — ${printingOrder.order_number}` : 'Receipt'}
                className="max-w-xs"
                contentClassName="bg-muted/40 p-4"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setPrintingOrder(null)}>Close</Button>
                        <Button className="flex-1" onClick={() => receiptRef.current && printReceipt(receiptRef.current)}>
                            <Printer className="h-4 w-4" /> Print
                        </Button>
                    </>
                }
            >
                {printingOrder && <div ref={receiptRef}><ThermalReceipt order={printingOrder} /></div>}
            </CrudModal>
        </AdminLayout>
    );
}
