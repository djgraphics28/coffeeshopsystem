import { Head, Link, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Printer, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { adminOrdersIndex, adminOrdersShow } from '@/lib/routes';
import { printReceipt, ThermalReceipt, type ReceiptOrder } from '@/components/thermal-receipt';

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    table: { name: string } | null;
    items: { id: number; menu_item: { name: string }; quantity: number; subtotal: number; addons: { name: string }[] }[];
    payment: { method: string; amount: number; reference_no: string | null } | null;
    created_at: string;
}

interface Paginated<T> {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    meta: { current_page: number; last_page: number; total: number };
}

interface Props {
    orders: Paginated<Order>;
    filters: { status?: string; date_from?: string; date_to?: string; type?: string };
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
    pending: { bg: '#FEF3C7', text: '#92400E' },
    preparing: { bg: '#DBEAFE', text: '#1E40AF' },
    ready: { bg: '#D1FAE5', text: '#065F46' },
    completed: { bg: '#F3F4F6', text: '#6B7280' },
    cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};

export default function OrdersIndex({ orders, filters }: Props) {
    const { data, setData, get } = useForm({ ...filters });
    const [printingOrder, setPrintingOrder] = useState<ReceiptOrder | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    function applyFilters(e: React.FormEvent) {
        e.preventDefault();
        get(adminOrdersIndex());
    }

    return (
        <AdminLayout>
            <Head title="Orders — Admin" />
            <div className="p-6">
                <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Orders</h1>

                {/* Filters */}
                <form onSubmit={applyFilters} className="mb-4 flex flex-wrap gap-3">
                    <select value={data.status ?? ''} onChange={(e) => setData('status', e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}>
                        <option value="">All Statuses</option>
                        {['pending', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                    <select value={data.type ?? ''} onChange={(e) => setData('type', e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}>
                        <option value="">All Types</option>
                        {['dine-in', 'takeout', 'walkin'].map((t) => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
                    </select>
                    <input type="date" value={data.date_from ?? ''} onChange={(e) => setData('date_from', e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }} />
                    <input type="date" value={data.date_to ?? ''} onChange={(e) => setData('date_to', e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm focus:outline-none" style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }} />
                    <button type="submit" className="rounded-xl px-4 py-1.5 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>Filter</button>
                    <button type="button" onClick={() => router.get(adminOrdersIndex())} className="rounded-xl border px-4 py-1.5 text-sm" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-muted)', background: 'var(--ap-card)' }}>Clear</button>
                </form>

                <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>{['Order #', 'Table', 'Type', 'Items', 'Total', 'Payment', 'Status', 'Time', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {orders.data.map((order) => {
                                const s = STATUS_STYLES[order.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
                                return (
                                    <tr key={order.id} className="border-t transition-colors" style={{ borderColor: 'var(--ap-border)' }}>
                                        <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: 'var(--ap-input-text)' }}>{order.order_number}</td>
                                        <td className="px-4 py-3" style={{ color: 'var(--ap-muted)' }}>{order.table?.name ?? 'Walk-in'}</td>
                                        <td className="px-4 py-3 capitalize" style={{ color: 'var(--ap-muted)' }}>{order.type.replace('-', ' ')}</td>
                                        <td className="px-4 py-3" style={{ color: 'var(--ap-muted)' }}>{order.items.length}</td>
                                        <td className="px-4 py-3 font-bold" style={{ color: '#D4A843' }}>₱{Number(order.total).toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            {order.payment ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 capitalize">{order.payment.method}</span> : <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>Unpaid</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-full px-2 py-0.5 text-xs capitalize" style={s}>{order.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>{new Date(order.created_at).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link href={adminOrdersShow(order.id)} className="text-xs font-medium" style={{ color: '#D4A843' }}>View</Link>
                                                <button
                                                    onClick={() => setPrintingOrder(order)}
                                                    className="rounded-lg p-1 transition-colors hover:bg-gray-100"
                                                    title="Print receipt"
                                                >
                                                    <Printer className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {orders.meta.last_page > 1 && (
                    <div className="mt-4 flex justify-center gap-1">
                        {orders.links.map((link, i) => (
                            <button key={i} disabled={!link.url || link.active} onClick={() => link.url && router.get(link.url)}
                                className="rounded-lg px-3 py-1.5 text-sm"
                                style={link.active ? { background: '#D4A843', color: '#2C1A0E', fontWeight: 700 } : { color: 'var(--ap-muted)', background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>
            {/* Receipt modal */}
            {printingOrder && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setPrintingOrder(null)} />
                    <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ background: 'var(--ap-card)' }}>
                        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--ap-border)' }}>
                            <span className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>
                                Receipt — {printingOrder.order_number}
                            </span>
                            <button onClick={() => setPrintingOrder(null)}><X className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                        </div>
                        <div className="max-h-96 overflow-y-auto p-4" style={{ background: 'var(--ap-bg)' }}>
                            <div ref={receiptRef}>
                                <ThermalReceipt order={printingOrder} />
                            </div>
                        </div>
                        <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--ap-border)' }}>
                            <button onClick={() => setPrintingOrder(null)} className="flex-1 rounded-full border py-2.5 text-sm font-medium" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-muted)' }}>
                                Close
                            </button>
                            <button
                                onClick={() => receiptRef.current && printReceipt(receiptRef.current)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold"
                                style={{ background: '#2C1A0E', color: '#D4A843' }}
                            >
                                <Printer className="h-4 w-4" />
                                Print
                            </button>
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
}
