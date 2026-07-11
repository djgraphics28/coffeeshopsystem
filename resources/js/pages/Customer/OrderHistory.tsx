import { Head, Link, router } from '@inertiajs/react';
import { storefrontOrdersShow } from '@/lib/routes';
import { ChevronRight, ReceiptText } from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

/* Retro-geometric palette shared with the storefront */
const P = {
    cream: '#E4DACB',
    creamLight: '#EFE8DC',
    navy: '#232B4A',
    terracotta: '#C05B2D',
    caramel: '#B5824F',
    espresso: '#3B2A1D',
    sand: '#D8CBB8',
};

const STATUS_STYLES: Record<string, { label: string; bg: string }> = {
    pending: { label: 'Pending', bg: '#B5824F' },
    preparing: { label: 'Preparing', bg: '#C05B2D' },
    ready: { label: 'Ready', bg: '#5B8A4E' },
    completed: { label: 'Completed', bg: '#232B4A' },
    cancelled: { label: 'Cancelled', bg: '#9CA3AF' },
    voided: { label: 'Voided', bg: '#9CA3AF' },
};

interface OrderItem {
    id: number;
    menu_item: { name: string };
    quantity: number;
}

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    total: number;
    created_at: string;
    items: OrderItem[];
}

interface Props {
    orders: Order[];
    pagination: { current_page: number; last_page: number; total: number };
    settings: { cafe_name: string; currency: string };
}

export default function OrderHistory({ orders, pagination, settings }: Props) {
    return (
        <div className="customer-page min-h-screen pb-24" style={{ background: P.cream, fontFamily: "'DM Sans', sans-serif", color: P.espresso }}>
            <Head title={`My Orders — ${settings.cafe_name}`} />

            <div className="px-5 py-6" style={{ background: P.navy }}>
                <div className="mx-auto max-w-2xl">
                    <h1 className="text-xl font-black uppercase tracking-tight text-white">My Orders</h1>
                    <p className="text-xs" style={{ color: P.cream }}>{pagination.total} order{pagination.total !== 1 ? 's' : ''} placed</p>
                </div>
            </div>

            <div className="mx-auto max-w-2xl space-y-3 px-4 py-5">
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center py-20" style={{ color: P.caramel }}>
                        <ReceiptText className="mb-3 h-12 w-12 opacity-30" />
                        <p className="text-sm">No orders yet</p>
                        <Link href="/order" className="mt-4 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white" style={{ background: P.terracotta }}>
                            Browse the menu
                        </Link>
                    </div>
                ) : (
                    orders.map((order) => {
                        const status = STATUS_STYLES[order.status] ?? { label: order.status, bg: P.caramel };
                        return (
                            <Link
                                key={order.id}
                                href={storefrontOrdersShow(order.id)}
                                className="block p-4 transition-shadow hover:shadow-md"
                                style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</p>
                                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: status.bg }}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="mt-1 truncate text-xs" style={{ color: P.caramel }}>
                                            {order.items.map((i) => `${i.quantity}× ${i.menu_item.name}`).join(', ')}
                                        </p>
                                        <p className="mt-0.5 text-[10px] capitalize" style={{ color: P.caramel }}>
                                            {order.type} · {new Date(order.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <span className="font-bold" style={{ color: P.terracotta }}>
                                            {settings.currency}{Number(order.total).toFixed(2)}
                                        </span>
                                        <ChevronRight className="h-4 w-4" style={{ color: P.caramel }} />
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}

                {pagination.last_page > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            disabled={pagination.current_page <= 1}
                            onClick={() => router.get('/order/my/orders', { page: pagination.current_page - 1 })}
                            className="px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-30"
                            style={{ background: P.navy }}
                        >
                            Prev
                        </button>
                        <span className="text-xs font-bold" style={{ color: P.espresso }}>
                            {pagination.current_page} / {pagination.last_page}
                        </span>
                        <button
                            disabled={pagination.current_page >= pagination.last_page}
                            onClick={() => router.get('/order/my/orders', { page: pagination.current_page + 1 })}
                            className="px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-30"
                            style={{ background: P.navy }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            <CustomerNav current="orders" />
        </div>
    );
}
