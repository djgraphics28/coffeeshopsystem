import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { ArrowLeft, Printer } from 'lucide-react';
import { useRef } from 'react';
import { adminOrdersIndex, adminOrdersUpdateStatus } from '@/lib/routes';
import { printReceipt, ThermalReceipt } from '@/components/thermal-receipt';

interface Props {
    order: {
        id: number;
        order_number: string;
        status: string;
        type: string;
        subtotal: number;
        tax: number;
        discount: number;
        total: number;
        notes: string | null;
        table: { name: string } | null;
        items: Array<{ id: number; menu_item: { name: string }; quantity: number; unit_price: number; subtotal: number; addons: Array<{ name: string }> }>;
        payment: { method: string; amount: number; reference_no: string | null; paid_at: string } | null;
        creator: { name: string } | null;
        created_at: string;
    };
}

export default function OrderShow({ order }: Props) {
    const { data, setData, patch, processing } = useForm({ status: order.status });
    const receiptRef = useRef<HTMLDivElement>(null);

    function updateStatus(e: React.FormEvent) {
        e.preventDefault();
        patch(adminOrdersUpdateStatus(order.id));
    }

    return (
        <AdminLayout>
            <Head title={`Order ${order.order_number} — Admin`} />
            <div className="p-6 max-w-2xl">
                <div className="mb-6 flex items-center gap-3">
                    <Link href={adminOrdersIndex()} className="rounded-lg p-2 hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-500" /></Link>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                        Order <span style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</span>
                    </h1>
                    <button
                        onClick={() => receiptRef.current && printReceipt(receiptRef.current)}
                        className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
                        style={{ background: '#2C1A0E', color: '#D4A843' }}
                    >
                        <Printer className="h-4 w-4" />
                        Print Receipt
                    </button>
                </div>

                {/* Hidden receipt node used for printing */}
                <div style={{ display: 'none' }}>
                    <div ref={receiptRef}>
                        <ThermalReceipt order={order} />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl bg-white p-5 shadow-sm">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="text-gray-500">Table</p><p className="font-semibold" style={{ color: '#2C1A0E' }}>{order.table?.name ?? 'Walk-in'}</p></div>
                            <div><p className="text-gray-500">Type</p><p className="font-semibold capitalize" style={{ color: '#2C1A0E' }}>{order.type.replace('-', ' ')}</p></div>
                            <div><p className="text-gray-500">Created</p><p className="font-semibold" style={{ color: '#2C1A0E' }}>{new Date(order.created_at).toLocaleString()}</p></div>
                            <div><p className="text-gray-500">Created by</p><p className="font-semibold" style={{ color: '#2C1A0E' }}>{order.creator?.name ?? 'Customer'}</p></div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-sm">
                        <h2 className="mb-3 font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>Items</h2>
                        <div className="space-y-2">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <div>
                                        <p className="font-medium" style={{ color: '#2C1A0E' }}>{item.quantity}× {item.menu_item.name}</p>
                                        {item.addons.length > 0 && <p className="text-xs text-gray-400">{item.addons.map((a) => a.name).join(', ')}</p>}
                                    </div>
                                    <p className="font-bold" style={{ color: '#D4A843' }}>₱{Number(item.subtotal).toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 border-t pt-3 space-y-1 text-sm">
                            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₱{Number(order.subtotal).toFixed(2)}</span></div>
                            {Number(order.discount) > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-₱{Number(order.discount).toFixed(2)}</span></div>}
                            <div className="flex justify-between text-gray-500"><span>Tax</span><span>₱{Number(order.tax).toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold text-base"><span style={{ color: '#2C1A0E' }}>Total</span><span style={{ color: '#D4A843' }}>₱{Number(order.total).toFixed(2)}</span></div>
                        </div>
                    </div>

                    {order.payment && (
                        <div className="rounded-2xl bg-white p-5 shadow-sm">
                            <h2 className="mb-3 font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>Payment</h2>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><p className="text-gray-500">Method</p><p className="font-semibold capitalize" style={{ color: '#2C1A0E' }}>{order.payment.method}</p></div>
                                <div><p className="text-gray-500">Amount</p><p className="font-semibold" style={{ color: '#2C1A0E' }}>₱{Number(order.payment.amount).toFixed(2)}</p></div>
                                {order.payment.reference_no && <div><p className="text-gray-500">Reference</p><p className="font-mono font-semibold" style={{ color: '#2C1A0E' }}>{order.payment.reference_no}</p></div>}
                                <div><p className="text-gray-500">Paid at</p><p className="font-semibold" style={{ color: '#2C1A0E' }}>{new Date(order.payment.paid_at).toLocaleString()}</p></div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={updateStatus} className="rounded-2xl bg-white p-5 shadow-sm">
                        <h2 className="mb-3 font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>Update Status</h2>
                        <div className="flex gap-3">
                            <select value={data.status} onChange={(e) => setData('status', e.target.value)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none">
                                {['pending', 'preparing', 'ready', 'completed', 'cancelled'].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                            </select>
                            <button type="submit" disabled={processing} className="rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                Update
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
