import { Head } from '@inertiajs/react';
import { posOrdersPayment, posOrdersStore, posOrdersUpdateStatus } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { CreditCard, Minus, Moon, Plus, Printer, Search, Sun, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import toast, { Toaster } from 'react-hot-toast';
import { printReceipt, ThermalReceipt } from '@/components/thermal-receipt';
import '../../echo';

interface Addon {
    id: number;
    name: string;
    additional_price: number;
}

interface AddonGroup {
    id: number;
    name: string;
    is_required: boolean;
    max_selections: number;
    addons: Addon[];
}

interface MenuItemVariation {
    id: number;
    name: string;
    price: number;
    sort_order: number;
}

interface MenuItem {
    id: number;
    name: string;
    description: string;
    price: number;
    display_price?: number;
    has_variations?: boolean;
    variations?: MenuItemVariation[];
    image_url: string | null;
    category_id: number;
    addon_groups: AddonGroup[];
}

interface Category {
    id: number;
    name: string;
    icon: string;
    menu_items: MenuItem[];
}

interface TableOption {
    id: number;
    name: string;
}

interface CartItem {
    id: string;
    menuItem: MenuItem;
    quantity: number;
    selectedVariation: MenuItemVariation | null;
    selectedAddons: Addon[];
    notes: string;
    unitPrice: number;
    subtotal: number;
}

interface Order {
    id: number;
    order_number: string;
    status: string;
    type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    table: { id: number; name: string } | null;
    items: Array<{ id: number; menu_item: { name: string }; quantity: number; subtotal: number; addons: Array<{ name: string }> }>;
    payment: { method: string; amount: number } | null;
    created_at: string;
}

interface Props {
    categories: Category[];
    tables: TableOption[];
    initialOrders: Order[];
    settings: { currency: string; tax_rate: number };
}

export default function PosTerminal({ categories, tables, initialOrders, settings }: Props) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(categories[0]?.id ?? null);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderType, setOrderType] = useState<'dine-in' | 'takeout' | 'walkin'>('walkin');
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [orderNotes, setOrderNotes] = useState('');
    const [discount, setDiscount] = useState(0);
    const [activeOrders, setActiveOrders] = useState<Order[]>(initialOrders);

    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [itemQty, setItemQty] = useState(1);
    const [itemVariationId, setItemVariationId] = useState<number | null>(null);
    const [itemAddons, setItemAddons] = useState<Record<number, number[]>>({});
    const [itemNotes, setItemNotes] = useState('');

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [payingOrder, setPayingOrder] = useState<Order | null>(null);
    const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'gcash' | 'maya'>('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receiptOrder, setReceiptOrder] = useState<(Order & { cashReceived?: number; change?: number; payMethod?: string }) | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    const currency = settings.currency;
    const taxRate = settings.tax_rate;

    const allItems = categories.flatMap((c) => c.menu_items);
    const filteredItems = searchQuery ? allItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())) : null;
    const displayItems = filteredItems ?? (activeCategoryId ? categories.find((c) => c.id === activeCategoryId)?.menu_items ?? [] : []);

    const cartSubtotal = cart.reduce((s, i) => s + i.subtotal, 0);
    const cartDiscount = Math.min(discount, cartSubtotal);
    const cartTax = (cartSubtotal - cartDiscount) * (taxRate / 100);
    const cartTotal = cartSubtotal - cartDiscount + cartTax;

    useEffect(() => {
        if (!window.Echo) return;
        window.Echo.channel('kitchen')
            .listen('.order.placed', (e: { order: Order }) => {
                setActiveOrders((prev) => [e.order, ...prev]);
            })
            .listen('.status.updated', (e: { order: Order }) => {
                if (e.order.status === 'completed' || e.order.status === 'cancelled') {
                    setActiveOrders((prev) => prev.filter((o) => o.id !== e.order.id));
                } else {
                    setActiveOrders((prev) => prev.map((o) => (o.id === e.order.id ? e.order : o)));
                }
            });
        return () => window.Echo.leaveChannel('kitchen');
    }, []);

    function openItemModal(item: MenuItem) {
        setSelectedItem(item);
        setItemQty(1);
        setItemVariationId(item.variations?.[0]?.id ?? null);
        setItemAddons({});
        setItemNotes('');
        setItemModalOpen(true);
    }

    function itemBasePrice(item: MenuItem, variationId: number | null): number {
        if (variationId) {
            return item.variations?.find((v) => v.id === variationId)?.price ?? item.price;
        }

        return item.display_price ?? item.price;
    }

    function toggleAddon(groupId: number, addonId: number, maxSelections: number) {
        setItemAddons((prev) => {
            const current = prev[groupId] ?? [];
            if (current.includes(addonId)) return { ...prev, [groupId]: current.filter((id) => id !== addonId) };
            if (maxSelections === 1) return { ...prev, [groupId]: [addonId] };
            if (current.length < maxSelections) return { ...prev, [groupId]: [...current, addonId] };
            return prev;
        });
    }

    function canAddToCart(): boolean {
        if (!selectedItem) return false;
        if (selectedItem.has_variations && !itemVariationId) return false;
        for (const group of selectedItem.addon_groups) {
            if (group.is_required && !(itemAddons[group.id]?.length > 0)) return false;
        }
        return true;
    }

    function addToCart() {
        if (!selectedItem || !canAddToCart()) return;
        const flatAddons = Object.values(itemAddons).flat().map((id) => selectedItem.addon_groups.flatMap((g) => g.addons).find((a) => a.id === id)!).filter(Boolean);
        const selectedVariation = selectedItem.variations?.find((v) => v.id === itemVariationId) ?? null;
        const addonTotal = flatAddons.reduce((s, a) => s + Number(a.additional_price), 0);
        const unitPrice = itemBasePrice(selectedItem, itemVariationId) + addonTotal;
        setCart((prev) => [...prev, { id: `${selectedItem.id}-${Date.now()}`, menuItem: selectedItem, quantity: itemQty, selectedVariation, selectedAddons: flatAddons, notes: itemNotes, unitPrice, subtotal: unitPrice * itemQty }]);
        setItemModalOpen(false);
        toast.success(`${selectedItem.name} added`);
    }

    const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    const socketId = () => window.Echo?.socketId() ?? '';

    async function placeOrder() {
        if (cart.length === 0) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(posOrdersStore(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
                body: JSON.stringify({
                    table_id: orderType === 'dine-in' ? selectedTableId : null,
                    type: orderType,
                    notes: orderNotes,
                    discount: cartDiscount,
                    items: cart.map((item) => ({ menu_item_id: item.menuItem.id, variation_id: item.selectedVariation?.id ?? null, quantity: item.quantity, notes: item.notes, addon_ids: item.selectedAddons.map((a) => a.id) })),
                }),
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setActiveOrders((prev) => [data.order, ...prev]);
            setCart([]);
            setOrderNotes('');
            setDiscount(0);
            toast.success(`Order ${data.order.order_number} placed!`);
        } catch {
            toast.error('Failed to place order');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function processPayment() {
        if (!payingOrder) return;
        setIsSubmitting(true);
        const paidAmount = parseFloat(cashReceived) || payingOrder.total;
        try {
            const res = await fetch(posOrdersPayment(payingOrder.id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
                body: JSON.stringify({ amount: paidAmount, method: payMethod, reference_no: referenceNo || null }),
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setActiveOrders((prev) => prev.filter((o) => o.id !== payingOrder.id));
            setPaymentModalOpen(false);
            toast.success('Payment recorded!');
            setReceiptOrder({
                ...data.order,
                payMethod,
                cashReceived: payMethod === 'cash' ? paidAmount : undefined,
                change: payMethod === 'cash' ? Math.max(0, paidAmount - data.order.total) : undefined,
            });
        } catch {
            toast.error('Payment failed');
        } finally {
            setIsSubmitting(false);
        }
    }

    function handlePrintReceipt() {
        if (receiptRef.current) printReceipt(receiptRef.current);
    }

    async function updateOrderStatus(orderId: number, status: string) {
        const res = await fetch(posOrdersUpdateStatus(orderId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            const data = await res.json();
            setActiveOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        }
    }

    return (
        <div className="admin-panel flex h-screen overflow-hidden" style={{ background: 'var(--ap-bg)', fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="POS Terminal — Milk&Honey Cafe" />
            <Toaster position="top-right" />

            {/* Left Panel — Menu Browser */}
            <div className="flex flex-1 flex-col overflow-hidden" style={{ borderRight: '1px solid var(--ap-border)' }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#2C1A0E', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ color: '#D4A843', fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700 }}>POS Terminal</span>
                    <div className="relative ml-auto w-56">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full bg-white/10 py-1.5 pl-9 pr-3 text-sm text-white placeholder-gray-400 focus:outline-none"
                        />
                    </div>
                    {mounted && (
                        <button
                            onClick={() => updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark')}
                            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                            title="Toggle dark mode"
                        >
                            {resolvedAppearance === 'dark'
                                ? <Sun className="h-4 w-4 text-yellow-300" />
                                : <Moon className="h-4 w-4 text-gray-400" />
                            }
                        </button>
                    )}
                </div>

                {/* Category Tabs */}
                {!searchQuery && (
                    <div className="flex gap-2 overflow-x-auto px-3 py-2" style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategoryId(cat.id)}
                                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                                style={{
                                    background: activeCategoryId === cat.id ? '#2C1A0E' : 'white',
                                    color: activeCategoryId === cat.id ? '#D4A843' : '#2C1A0E',
                                    border: `1px solid ${activeCategoryId === cat.id ? '#2C1A0E' : '#E5DDD0'}`,
                                }}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Item Grid */}
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
                        {displayItems.map((item) => (
                            <motion.button
                                key={item.id}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => openItemModal(item)}
                                className="overflow-hidden rounded-xl bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-lg" style={{ background: '#FDF6EC' }}>
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="text-3xl">☕</span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold leading-tight" style={{ color: '#2C1A0E' }}>{item.name}</p>
                                <p className="mt-1 text-sm font-bold" style={{ color: '#D4A843' }}>
                                    {item.has_variations ? `From ${currency}${(item.display_price ?? item.price).toFixed(2)}` : `${currency}${item.price.toFixed(2)}`}
                                </p>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Active Orders Tabs */}
                <div style={{ background: 'var(--ap-card)', borderTop: '1px solid var(--ap-border)', maxHeight: '200px', overflow: 'hidden' }}>
                    <div className="flex items-center justify-between px-4 py-2">
                        <p className="text-xs font-semibold" style={{ color: '#2C1A0E' }}>Today's Active Orders</p>
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                            {activeOrders.length}
                        </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto px-3 pb-3">
                        {activeOrders.map((order) => (
                            <div
                                key={order.id}
                                className="shrink-0 cursor-pointer rounded-lg p-2 text-xs"
                                style={{ background: '#FDF6EC', minWidth: '120px' }}
                            >
                                <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#2C1A0E' }}>{order.order_number}</p>
                                <p className="text-gray-500">{order.table?.name ?? 'Walk-in'}</p>
                                <div className="mt-1 flex items-center justify-between">
                                    <StatusPill status={order.status} />
                                    {!order.payment && (
                                        <button
                                            onClick={() => { setPayingOrder(order); setPaymentModalOpen(true); }}
                                            className="rounded px-1.5 py-0.5 text-xs font-bold"
                                            style={{ background: '#D4A843', color: '#2C1A0E' }}
                                        >
                                            Pay
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {activeOrders.length === 0 && (
                            <p className="px-2 py-3 text-xs text-gray-400">No active orders today</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel — Order Builder */}
            <div className="flex w-96 flex-col" style={{ background: 'var(--ap-card)' }}>
                <div className="px-4 py-3" style={{ background: '#2C1A0E' }}>
                    <p className="font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>New Order</p>
                </div>

                {/* Order Type */}
                <div className="flex gap-1 px-4 pt-4">
                    {(['walkin', 'dine-in', 'takeout'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className="flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition-all"
                            style={{
                                background: orderType === type ? '#2C1A0E' : '#F3F0EC',
                                color: orderType === type ? '#D4A843' : '#6B7280',
                            }}
                        >
                            {type.replace('-', ' ')}
                        </button>
                    ))}
                </div>

                {/* Table selector for dine-in */}
                {orderType === 'dine-in' && (
                    <div className="px-4 pt-3">
                        <select
                            value={selectedTableId ?? ''}
                            onChange={(e) => setSelectedTableId(Number(e.target.value) || null)}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                        >
                            <option value="">Select table...</option>
                            {tables.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                            <span className="text-5xl">🛒</span>
                            <p className="mt-3 text-sm">Click items to add</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {cart.map((item) => (
                                <div key={item.id} className="rounded-xl bg-gray-50 p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold" style={{ color: '#2C1A0E' }}>{item.menuItem.name}</p>
                                            {(item.selectedVariation || item.selectedAddons.length > 0) && (
                                                <p className="text-xs text-gray-400">
                                                    {[item.selectedVariation?.name, ...item.selectedAddons.map((a) => a.name)].filter(Boolean).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        <button onClick={() => setCart((prev) => prev.filter((i) => i.id !== item.id))}>
                                            <X className="h-4 w-4 text-gray-300 hover:text-red-400" />
                                        </button>
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between">
                                        <div className="flex items-center gap-1 rounded-full border border-gray-200 px-1.5">
                                            <button onClick={() => setCart((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1), subtotal: i.unitPrice * Math.max(1, i.quantity - 1) } : i).filter((i) => i.quantity > 0))}>
                                                <Minus className="h-3 w-3" style={{ color: '#2C1A0E' }} />
                                            </button>
                                            <span className="w-5 text-center text-xs font-bold" style={{ color: '#2C1A0E' }}>{item.quantity}</span>
                                            <button onClick={() => setCart((prev) => prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1, subtotal: i.unitPrice * (i.quantity + 1) } : i))}>
                                                <Plus className="h-3 w-3" style={{ color: '#2C1A0E' }} />
                                            </button>
                                        </div>
                                        <span className="text-sm font-bold" style={{ color: '#D4A843' }}>{currency}{item.subtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Order Footer */}
                <div className="border-t border-gray-100 px-4 py-4">
                    <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Order notes..."
                        className="mb-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                        rows={2}
                    />
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Discount ({currency})</span>
                        <input
                            type="number"
                            min={0}
                            value={discount || ''}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="ml-auto w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm focus:border-yellow-400 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-1 text-xs text-gray-500">
                        <div className="flex justify-between"><span>Subtotal</span><span>{currency}{cartSubtotal.toFixed(2)}</span></div>
                        {cartDiscount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{currency}{cartDiscount.toFixed(2)}</span></div>}
                        <div className="flex justify-between"><span>Tax ({taxRate}%)</span><span>{currency}{cartTax.toFixed(2)}</span></div>
                    </div>
                    <div className="my-2 flex justify-between font-bold">
                        <span style={{ color: '#2C1A0E' }}>Total</span>
                        <span style={{ color: '#D4A843', fontSize: '18px' }}>{currency}{cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={placeOrder}
                        disabled={cart.length === 0 || isSubmitting}
                        className="w-full rounded-full py-3.5 text-sm font-bold transition-all disabled:opacity-40"
                        style={{ background: '#2C1A0E', color: '#D4A843' }}
                    >
                        {isSubmitting ? 'Placing...' : '🛒 Place Order'}
                    </button>
                </div>
            </div>

            {/* Item Modal */}
            <AnimatePresence>
                {itemModalOpen && selectedItem && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setItemModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
                            style={{ zIndex: 60, maxHeight: '80vh' }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-bold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>{selectedItem.name}</h2>
                                    <p className="text-sm text-gray-500">{selectedItem.description}</p>
                                    <p className="mt-1 font-bold" style={{ color: '#D4A843' }}>
                                    {selectedItem.has_variations && !itemVariationId
                                        ? `From ${currency}${(selectedItem.display_price ?? selectedItem.price).toFixed(2)}`
                                        : `${currency}${itemBasePrice(selectedItem, itemVariationId).toFixed(2)}`}
                                </p>
                                </div>
                                <button onClick={() => setItemModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
                            </div>

                            {selectedItem.variations && selectedItem.variations.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-semibold" style={{ color: '#2C1A0E' }}>
                                        Size <span className="text-red-400">*</span>
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedItem.variations.map((variation) => {
                                            const isSel = itemVariationId === variation.id;
                                            return (
                                                <button
                                                    key={variation.id}
                                                    onClick={() => setItemVariationId(variation.id)}
                                                    className="flex flex-col items-center rounded-xl px-3 py-1.5 text-xs transition-all"
                                                    style={{
                                                        background: isSel ? '#FDF6EC' : '#F9F9F9',
                                                        border: `2px solid ${isSel ? '#D4A843' : '#E5E5E5'}`,
                                                        color: '#2C1A0E',
                                                        minWidth: '60px',
                                                    }}
                                                >
                                                    <span className="font-medium">{variation.name}</span>
                                                    <span className="text-[10px]" style={{ color: '#D4A843' }}>
                                                        {currency}{variation.price.toFixed(2)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {selectedItem.addon_groups.map((group) => (
                                <div key={group.id} className="mt-4">
                                    <p className="text-sm font-semibold" style={{ color: '#2C1A0E' }}>
                                        {group.name} {group.is_required && <span className="text-red-400">*</span>}
                                        {group.max_selections > 1 && <span className="ml-1 text-xs text-gray-400">(max {group.max_selections})</span>}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {group.addons.map((addon) => {
                                            const isSel = itemAddons[group.id]?.includes(addon.id);
                                            const priceLabel = addon.additional_price > 0
                                                ? `+${currency}${addon.additional_price}`
                                                : addon.additional_price < 0
                                                    ? `-${currency}${Math.abs(addon.additional_price)}`
                                                    : 'Free';
                                            return (
                                                <button
                                                    key={addon.id}
                                                    onClick={() => toggleAddon(group.id, addon.id, group.max_selections)}
                                                    className="flex flex-col items-center rounded-xl px-3 py-1.5 text-xs transition-all"
                                                    style={{
                                                        background: isSel ? '#FDF6EC' : '#F9F9F9',
                                                        border: `2px solid ${isSel ? '#D4A843' : '#E5E5E5'}`,
                                                        color: '#2C1A0E',
                                                        minWidth: '60px',
                                                    }}
                                                >
                                                    <span className="font-medium">{addon.name}</span>
                                                    <span className="text-[10px]" style={{ color: addon.additional_price !== 0 ? '#D4A843' : '#9CA3AF' }}>
                                                        {priceLabel}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex items-center gap-2 rounded-full border px-2">
                                    <button onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="p-1.5"><Minus className="h-4 w-4" /></button>
                                    <span className="w-6 text-center font-bold">{itemQty}</span>
                                    <button onClick={() => setItemQty(itemQty + 1)} className="p-1.5"><Plus className="h-4 w-4" /></button>
                                </div>
                                <button onClick={addToCart} disabled={!canAddToCart()} className="flex-1 rounded-full py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    Add to Order
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Receipt Modal */}
            <AnimatePresence>
                {receiptOrder && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50" style={{ zIndex: 50 }} onClick={() => setReceiptOrder(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl overflow-hidden"
                            style={{ zIndex: 60 }}
                        >
                            {/* Modal header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <span className="font-bold text-sm" style={{ color: '#2C1A0E' }}>Receipt Ready</span>
                                <button onClick={() => setReceiptOrder(null)}><X className="h-4 w-4 text-gray-400" /></button>
                            </div>

                            {/* Receipt preview */}
                            <div className="overflow-y-auto max-h-96 bg-gray-50 p-4">
                                <div ref={receiptRef}>
                                    <ThermalReceipt order={receiptOrder} currency={currency} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
                                <button onClick={() => setReceiptOrder(null)} className="flex-1 rounded-full border border-gray-200 py-2.5 text-sm font-medium text-gray-500">
                                    Close
                                </button>
                                <button onClick={handlePrintReceipt} className="flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                                    <Printer className="h-4 w-4" />
                                    Print
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Payment Modal */}
            <AnimatePresence>
                {paymentModalOpen && payingOrder && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setPaymentModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
                            style={{ zIndex: 60 }}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold text-lg" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                                    <CreditCard className="mr-2 inline h-5 w-5" />
                                    Payment
                                </h2>
                                <button onClick={() => setPaymentModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
                            </div>

                            <div className="mt-2 rounded-xl p-3" style={{ background: '#FDF6EC' }}>
                                <p className="text-xs text-gray-500">Order</p>
                                <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace", color: '#2C1A0E' }}>{payingOrder.order_number}</p>
                                <p className="mt-1 text-xl font-bold" style={{ color: '#D4A843' }}>{currency}{payingOrder.total.toFixed(2)}</p>
                            </div>

                            <div className="mt-4 grid grid-cols-4 gap-2">
                                {(['cash', 'card', 'gcash', 'maya'] as const).map((method) => (
                                    <button key={method} onClick={() => setPayMethod(method)} className="rounded-xl py-2 text-xs font-semibold capitalize transition-all" style={{ background: payMethod === method ? '#2C1A0E' : '#F3F0EC', color: payMethod === method ? '#D4A843' : '#6B7280' }}>
                                        {method}
                                    </button>
                                ))}
                            </div>

                            {payMethod === 'cash' && (
                                <div className="mt-3">
                                    <label className="text-xs text-gray-500">Cash received</label>
                                    <input type="number" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={payingOrder.total.toFixed(2)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-lg font-bold focus:border-yellow-400 focus:outline-none" style={{ color: '#2C1A0E' }} />
                                    {parseFloat(cashReceived) >= payingOrder.total && (
                                        <p className="mt-1 text-sm text-green-600 font-semibold">Change: {currency}{(parseFloat(cashReceived) - payingOrder.total).toFixed(2)}</p>
                                    )}
                                </div>
                            )}

                            {(['card', 'gcash', 'maya'] as const).includes(payMethod as 'card' | 'gcash' | 'maya') && (
                                <div className="mt-3">
                                    <label className="text-xs text-gray-500">Reference number</label>
                                    <input type="text" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Enter reference no." className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                </div>
                            )}

                            <button onClick={processPayment} disabled={isSubmitting} className="mt-4 w-full rounded-full py-3 font-bold disabled:opacity-40" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                {isSubmitting ? 'Processing...' : '✓ Confirm Payment'}
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#FEF3C7', text: '#92400E' },
        preparing: { bg: '#DBEAFE', text: '#1E40AF' },
        ready: { bg: '#D1FAE5', text: '#065F46' },
        completed: { bg: '#F3F4F6', text: '#6B7280' },
        cancelled: { bg: '#FEE2E2', text: '#991B1B' },
    };
    const c = colors[status] ?? { bg: '#F3F4F6', text: '#6B7280' };
    return (
        <span className="rounded-full px-2 py-0.5 text-xs capitalize" style={{ background: c.bg, color: c.text }}>
            {status}
        </span>
    );
}
