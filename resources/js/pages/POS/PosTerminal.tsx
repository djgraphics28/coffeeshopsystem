import { Head } from '@inertiajs/react';
import { posCustomersSearch, posCustomersStore, posOrdersPayment, posOrdersStore, posOrdersUpdateStatus, posOrdersVoid } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Ban, ChevronDown, ChevronUp, Coffee, CreditCard, LayoutDashboard,
    Minus, Moon, Plus, Printer, Search, Star, Sun, Tag, UserCircle, UserPlus, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import toast, { Toaster } from 'react-hot-toast';
import { printReceipt, ThermalReceipt } from '@/components/thermal-receipt';
import '../../echo';

interface Addon { id: number; name: string; additional_price: number }
interface AddonGroup { id: number; name: string; is_required: boolean; max_selections: number; addons: Addon[] }
interface MenuItemVariation { id: number; name: string; price: number; sort_order: number }
interface MenuItem {
    id: number; name: string; description: string; price: number;
    display_price?: number; has_variations?: boolean; variations?: MenuItemVariation[];
    image_url: string | null; category_id: number; addon_groups: AddonGroup[];
}
interface Category { id: number; name: string; icon: string; menu_items: MenuItem[] }
interface TableOption { id: number; name: string }
interface CartItem {
    id: string; menuItem: MenuItem; quantity: number;
    selectedVariation: MenuItemVariation | null; selectedAddons: Addon[];
    notes: string; unitPrice: number; subtotal: number;
}
interface Order {
    id: number; order_number: string; status: string; type: string;
    subtotal: number; tax: number; discount: number; total: number;
    table: { id: number; name: string } | null;
    items: Array<{ id: number; menu_item: { name: string }; quantity: number; subtotal: number; addons: Array<{ name: string }> }>;
    payment: { method: string; amount: number } | null;
    created_at: string;
}
interface Customer {
    id: number; name: string; phone: string | null; email: string | null;
    notes: string | null; points: number; cup_count: number; free_drinks_available: number;
}
interface Props {
    categories: Category[];
    tables: TableOption[];
    initialOrders: Order[];
    settings: { currency: string; tax_rate: number; pay_as_you_order: boolean };
}

const STATUS_FLOW: Record<string, string | null> = {
    pending: 'preparing',
    preparing: 'ready',
    ready: 'completed',
    completed: null,
    cancelled: null,
    voided: null,
};

const STATUS_LABEL: Record<string, string> = {
    pending: 'Mark Preparing',
    preparing: 'Mark Ready',
    ready: 'Complete',
};

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
    const [ordersExpanded, setOrdersExpanded] = useState(true);

    // Item modal
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [itemQty, setItemQty] = useState(1);
    const [itemVariationId, setItemVariationId] = useState<number | null>(null);
    const [itemAddons, setItemAddons] = useState<Record<number, number[]>>({});
    const [itemNotes, setItemNotes] = useState('');

    // Customer
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerModalOpen, setCustomerModalOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [customerSearching, setCustomerSearching] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerPhone, setNewCustomerPhone] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [customerTab, setCustomerTab] = useState<'search' | 'new'>('search');
    const [customerSaving, setCustomerSaving] = useState(false);

    // Payment
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [payingOrder, setPayingOrder] = useState<Order | null>(null);
    const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'gcash' | 'maya'>('cash');
    const [cashReceived, setCashReceived] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [receiptOrder, setReceiptOrder] = useState<(Order & { cashReceived?: number; change?: number; payMethod?: string }) | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    // Void
    const [voidingOrder, setVoidingOrder] = useState<Order | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voidProcessing, setVoidProcessing] = useState(false);

    const currency = settings.currency;
    const taxRate = settings.tax_rate;
    const payAsYouOrder = settings.pay_as_you_order;

    const allItems = categories.flatMap((c) => c.menu_items);
    const filteredItems = searchQuery ? allItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())) : null;
    const displayItems = filteredItems ?? (activeCategoryId ? categories.find((c) => c.id === activeCategoryId)?.menu_items ?? [] : []);

    const cartSubtotal = cart.reduce((s, i) => s + i.subtotal, 0);
    const cartDiscount = Math.min(discount, cartSubtotal);
    const cartTax = (cartSubtotal - cartDiscount) * (taxRate / 100);
    const cartTotal = cartSubtotal - cartDiscount + cartTax;

    const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    const socketId = () => (window as any).Echo?.socketId() ?? '';

    useEffect(() => {
        if (!(window as any).Echo) return;
        (window as any).Echo.channel('kitchen')
            .listen('.order.placed', (e: { order: Order }) => setActiveOrders((prev) => [e.order, ...prev]))
            .listen('.status.updated', (e: { order: Order }) => {
                if (['completed', 'cancelled', 'voided'].includes(e.order.status)) {
                    setActiveOrders((prev) => prev.filter((o) => o.id !== e.order.id));
                } else {
                    setActiveOrders((prev) => prev.map((o) => (o.id === e.order.id ? e.order : o)));
                }
            });
        return () => (window as any).Echo.leaveChannel('kitchen');
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
        if (variationId) return item.variations?.find((v) => v.id === variationId)?.price ?? item.price;
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
        const flatAddons = Object.values(itemAddons).flat()
            .map((id) => selectedItem.addon_groups.flatMap((g) => g.addons).find((a) => a.id === id)!)
            .filter(Boolean);
        const selectedVariation = selectedItem.variations?.find((v) => v.id === itemVariationId) ?? null;
        const addonTotal = flatAddons.reduce((s, a) => s + Number(a.additional_price), 0);
        const unitPrice = itemBasePrice(selectedItem, itemVariationId) + addonTotal;
        setCart((prev) => [...prev, {
            id: `${selectedItem.id}-${Date.now()}`,
            menuItem: selectedItem, quantity: itemQty, selectedVariation,
            selectedAddons: flatAddons, notes: itemNotes, unitPrice,
            subtotal: unitPrice * itemQty,
        }]);
        setItemModalOpen(false);
        toast.success(`${selectedItem.name} added`);
    }

    async function searchCustomers(q: string) {
        setCustomerSearch(q);
        if (!q.trim()) { setCustomerResults([]); return; }
        setCustomerSearching(true);
        try {
            const res = await fetch(`${posCustomersSearch()}?q=${encodeURIComponent(q)}`, { headers: { 'X-CSRF-TOKEN': csrfToken() } });
            setCustomerResults(await res.json());
        } finally {
            setCustomerSearching(false);
        }
    }

    async function saveNewCustomer() {
        if (!newCustomerName.trim()) return;
        setCustomerSaving(true);
        try {
            const res = await fetch(posCustomersStore(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken() },
                body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone || null, email: newCustomerEmail || null }),
            });
            if (!res.ok) throw new Error();
            const customer = await res.json();
            setSelectedCustomer(customer);
            setCustomerModalOpen(false);
            setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail('');
            toast.success(`${customer.name} added!`);
        } catch { toast.error('Failed to save customer'); }
        finally { setCustomerSaving(false); }
    }

    async function placeOrder() {
        if (cart.length === 0) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(posOrdersStore(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
                body: JSON.stringify({
                    table_id: orderType === 'dine-in' ? selectedTableId : null,
                    customer_id: selectedCustomer?.id ?? null,
                    type: orderType, notes: orderNotes, discount: cartDiscount,
                    items: cart.map((item) => ({
                        menu_item_id: item.menuItem.id,
                        variation_id: item.selectedVariation?.id ?? null,
                        quantity: item.quantity, notes: item.notes,
                        addon_ids: item.selectedAddons.map((a) => a.id),
                    })),
                }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setActiveOrders((prev) => [data.order, ...prev]);
            setCart([]); setOrderNotes(''); setDiscount(0); setSelectedCustomer(null);
            toast.success(`Order ${data.order.order_number} placed!`);
            if (payAsYouOrder) {
                setPayingOrder(data.order); setPayMethod('cash'); setCashReceived(''); setReferenceNo('');
                setPaymentModalOpen(true);
            }
        } catch { toast.error('Failed to place order'); }
        finally { setIsSubmitting(false); }
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
            if (!res.ok) throw new Error();
            const data = await res.json();
            setActiveOrders((prev) => prev.filter((o) => o.id !== payingOrder.id));
            setPaymentModalOpen(false);
            toast.success('Payment recorded!');
            setReceiptOrder({
                ...data.order, payMethod,
                cashReceived: payMethod === 'cash' ? paidAmount : undefined,
                change: payMethod === 'cash' ? Math.max(0, paidAmount - data.order.total) : undefined,
            });
        } catch { toast.error('Payment failed'); }
        finally { setIsSubmitting(false); }
    }

    async function updateOrderStatus(orderId: number, status: string) {
        const res = await fetch(posOrdersUpdateStatus(orderId), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            const data = await res.json();
            if (['completed', 'cancelled', 'voided'].includes(status)) {
                setActiveOrders((prev) => prev.filter((o) => o.id !== orderId));
            } else {
                setActiveOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
            }
        }
    }

    async function voidOrder() {
        if (!voidingOrder) return;
        setVoidProcessing(true);
        try {
            const res = await fetch(posOrdersVoid(voidingOrder.id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), 'X-Socket-ID': socketId() },
                body: JSON.stringify({ void_reason: voidReason }),
            });
            if (!res.ok) throw new Error();
            setActiveOrders((prev) => prev.filter((o) => o.id !== voidingOrder.id));
            setVoidingOrder(null); setVoidReason('');
            toast.success('Order voided');
        } catch { toast.error('Failed to void order'); }
        finally { setVoidProcessing(false); }
    }

    function openPayment(order: Order) {
        setPayingOrder(order); setPayMethod('cash'); setCashReceived(''); setReferenceNo('');
        setPaymentModalOpen(true);
    }

    // Quick cash presets above the order total
    function quickCashPresets(total: number): number[] {
        const roundUp = (v: number, to: number) => Math.ceil(v / to) * to;
        const exact = parseFloat(total.toFixed(2));
        const candidates = [exact, roundUp(total, 50), roundUp(total, 100), roundUp(total, 200), roundUp(total, 500), 1000];
        return [...new Set(candidates)].slice(0, 5);
    }

    return (
        <div className="admin-panel flex h-screen overflow-hidden" style={{ background: 'var(--ap-bg)', fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="POS Terminal — Milk&Honey Cafe" />
            <Toaster position="top-right" />

            {/* ── Left Panel ── */}
            <div className="flex flex-1 flex-col overflow-hidden" style={{ borderRight: '1px solid var(--ap-border)' }}>

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: '#2C1A0E' }}>
                    <a href="/admin" className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10" title="Dashboard">
                        <LayoutDashboard className="h-4 w-4" style={{ color: '#D4A843' }} />
                    </a>
                    <span style={{ color: '#D4A843', fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700 }}>
                        POS Terminal
                    </span>
                    <div className="relative ml-auto w-56">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full py-1.5 pl-9 pr-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
                            style={{ background: 'rgba(255,255,255,0.12)' }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="h-3.5 w-3.5 text-white/50" />
                            </button>
                        )}
                    </div>
                    {mounted && (
                        <button onClick={() => updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark')} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10">
                            {resolvedAppearance === 'dark' ? <Sun className="h-4 w-4 text-yellow-300" /> : <Moon className="h-4 w-4 text-white/60" />}
                        </button>
                    )}
                </div>

                {/* Category tabs */}
                {!searchQuery && (
                    <div className="flex gap-2 overflow-x-auto px-3 py-2 shrink-0" style={{ background: 'var(--ap-card)', borderBottom: '1px solid var(--ap-border)' }}>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategoryId(cat.id)}
                                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                                style={{
                                    background: activeCategoryId === cat.id ? '#2C1A0E' : 'var(--ap-bg)',
                                    color: activeCategoryId === cat.id ? '#D4A843' : 'var(--ap-muted)',
                                    border: `1px solid ${activeCategoryId === cat.id ? '#2C1A0E' : 'var(--ap-border)'}`,
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
                    {displayItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--ap-muted)' }}>
                            <Coffee className="h-12 w-12 opacity-20 mb-3" />
                            <p className="text-sm">{searchQuery ? 'No items match your search.' : 'No items in this category.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
                            {displayItems.map((item) => (
                                <motion.button
                                    key={item.id}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => openItemModal(item)}
                                    className="overflow-hidden rounded-xl text-left shadow-sm transition-shadow hover:shadow-md"
                                    style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}
                                >
                                    <div className="flex h-20 items-center justify-center overflow-hidden rounded-t-xl" style={{ background: 'var(--ap-bg)' }}>
                                        {item.image_url
                                            ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                            : <span className="text-3xl">☕</span>}
                                    </div>
                                    <div className="p-2.5">
                                        <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--ap-input-text)' }}>{item.name}</p>
                                        <p className="mt-0.5 text-sm font-bold" style={{ color: '#D4A843' }}>
                                            {item.has_variations ? `From ${currency}${(item.display_price ?? item.price).toFixed(2)}` : `${currency}${item.price.toFixed(2)}`}
                                        </p>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Active Orders Panel */}
                <div className="shrink-0" style={{ background: 'var(--ap-card)', borderTop: '1px solid var(--ap-border)' }}>
                    <button
                        onClick={() => setOrdersExpanded((v) => !v)}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: 'var(--ap-input-text)' }}>Active Orders</span>
                            {activeOrders.length > 0 && (
                                <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {activeOrders.length}
                                </span>
                            )}
                        </div>
                        {ordersExpanded ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /> : <ChevronUp className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />}
                    </button>
                    <AnimatePresence>
                        {ordersExpanded && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex gap-2 overflow-x-auto px-3 pb-3" style={{ maxHeight: '200px' }}>
                                    {activeOrders.length === 0 ? (
                                        <p className="py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>No active orders right now</p>
                                    ) : activeOrders.map((order) => (
                                        <div key={order.id} className="shrink-0 rounded-xl p-3 text-xs" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', minWidth: '150px' }}>
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="font-bold" style={{ fontFamily: "'Space Mono', monospace", color: 'var(--ap-input-text)', fontSize: '11px' }}>{order.order_number}</p>
                                                <StatusPill status={order.status} />
                                            </div>
                                            <p className="mb-2" style={{ color: 'var(--ap-muted)' }}>{order.table?.name ?? 'Walk-in'} · {currency}{order.total.toFixed(2)}</p>
                                            <div className="flex flex-col gap-1">
                                                {STATUS_FLOW[order.status] && (
                                                    <button
                                                        onClick={() => updateOrderStatus(order.id, STATUS_FLOW[order.status]!)}
                                                        className="rounded-lg px-2 py-1 text-xs font-semibold text-center"
                                                        style={{ background: '#2C1A0E', color: '#D4A843' }}
                                                    >
                                                        {STATUS_LABEL[order.status] ?? 'Next'}
                                                    </button>
                                                )}
                                                <div className="flex gap-1">
                                                    {!order.payment && (
                                                        <button
                                                            onClick={() => openPayment(order)}
                                                            className="flex-1 rounded-lg px-2 py-1 text-xs font-bold text-center"
                                                            style={{ background: '#D4A843', color: '#2C1A0E' }}
                                                        >
                                                            Pay
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => { setVoidingOrder(order); setVoidReason(''); }}
                                                        className="rounded-lg p-1 transition-colors hover:bg-red-100"
                                                        title="Void order"
                                                    >
                                                        <Ban className="h-3.5 w-3.5 text-red-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Right Panel — Order Builder ── */}
            <div className="flex w-96 shrink-0 flex-col" style={{ background: 'var(--ap-card)' }}>
                {/* Panel header */}
                <div className="shrink-0 px-4 py-3" style={{ background: '#2C1A0E' }}>
                    <p className="font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>New Order</p>
                </div>

                {/* Order type */}
                <div className="flex gap-1 px-4 pt-4 shrink-0">
                    {(['walkin', 'dine-in', 'takeout'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className="flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition-all"
                            style={{
                                background: orderType === type ? '#2C1A0E' : 'var(--ap-bg)',
                                color: orderType === type ? '#D4A843' : 'var(--ap-muted)',
                                border: `1px solid ${orderType === type ? '#2C1A0E' : 'var(--ap-border)'}`,
                            }}
                        >
                            {type.replace('-', ' ')}
                        </button>
                    ))}
                </div>

                {/* Table selector */}
                {orderType === 'dine-in' && (
                    <div className="px-4 pt-3 shrink-0">
                        <select
                            value={selectedTableId ?? ''}
                            onChange={(e) => setSelectedTableId(Number(e.target.value) || null)}
                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                        >
                            <option value="">Select table...</option>
                            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                )}

                {/* Customer selector */}
                <div className="px-4 pt-3 shrink-0">
                    <button
                        onClick={() => { setCustomerTab('search'); setCustomerSearch(''); setCustomerResults([]); setCustomerModalOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all"
                        style={selectedCustomer
                            ? { border: '1px solid #D4A843', background: '#D4A84312', color: 'var(--ap-input-text)' }
                            : { border: '1px solid var(--ap-border)', background: 'var(--ap-bg)', color: 'var(--ap-muted)' }}
                    >
                        <UserCircle className="h-4 w-4 shrink-0" style={{ color: selectedCustomer ? '#D4A843' : 'var(--ap-muted)' }} />
                        <span className="flex-1 truncate text-left">
                            {selectedCustomer ? selectedCustomer.name : 'Select customer (optional)'}
                        </span>
                        {selectedCustomer && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }} className="shrink-0 rounded p-0.5 hover:bg-black/10">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </button>
                    {selectedCustomer && (
                        <div className="mt-1.5 flex items-center gap-3 px-1">
                            {selectedCustomer.points > 0 && (
                                <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: '#D97706' }}>
                                    <Star className="h-3 w-3" /> {selectedCustomer.points.toLocaleString()} pts
                                </span>
                            )}
                            {selectedCustomer.cup_count > 0 && (
                                <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: '#2C1A0E' }}>
                                    ☕ {selectedCustomer.cup_count} cups
                                </span>
                            )}
                            {selectedCustomer.free_drinks_available > 0 && (
                                <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
                                    🎁 {selectedCustomer.free_drinks_available} free
                                </span>
                            )}
                            {selectedCustomer.phone && !selectedCustomer.points && (
                                <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>{selectedCustomer.phone}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Cart */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--ap-muted)' }}>
                            <span className="text-5xl mb-3">🛒</span>
                            <p className="text-sm">Tap items on the left to add</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {cart.map((item) => (
                                <div key={item.id} className="rounded-xl p-3" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)' }}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>{item.menuItem.name}</p>
                                            {(item.selectedVariation || item.selectedAddons.length > 0) && (
                                                <p className="text-xs truncate" style={{ color: 'var(--ap-muted)' }}>
                                                    {[item.selectedVariation?.name, ...item.selectedAddons.map((a) => a.name)].filter(Boolean).join(', ')}
                                                </p>
                                            )}
                                            {item.notes && (
                                                <p className="mt-0.5 text-xs italic" style={{ color: 'var(--ap-muted)' }}>"{item.notes}"</p>
                                            )}
                                        </div>
                                        <button onClick={() => setCart((prev) => prev.filter((i) => i.id !== item.id))}>
                                            <X className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                        </button>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="flex items-center gap-1 rounded-full px-1.5 py-0.5" style={{ border: '1px solid var(--ap-border)', background: 'var(--ap-card)' }}>
                                            <button
                                                onClick={() => setCart((prev) => prev.map((i) => i.id === item.id
                                                    ? { ...i, quantity: Math.max(1, i.quantity - 1), subtotal: i.unitPrice * Math.max(1, i.quantity - 1) }
                                                    : i))}
                                            >
                                                <Minus className="h-3 w-3" style={{ color: 'var(--ap-input-text)' }} />
                                            </button>
                                            <span className="w-5 text-center text-xs font-bold" style={{ color: 'var(--ap-input-text)' }}>{item.quantity}</span>
                                            <button
                                                onClick={() => setCart((prev) => prev.map((i) => i.id === item.id
                                                    ? { ...i, quantity: i.quantity + 1, subtotal: i.unitPrice * (i.quantity + 1) }
                                                    : i))}
                                            >
                                                <Plus className="h-3 w-3" style={{ color: 'var(--ap-input-text)' }} />
                                            </button>
                                        </div>
                                        <span className="text-sm font-bold" style={{ color: '#D4A843' }}>{currency}{item.subtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Order footer */}
                <div className="shrink-0 px-4 py-4" style={{ borderTop: '1px solid var(--ap-border)' }}>
                    <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Order notes..."
                        rows={2}
                        className="mb-3 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                    />
                    <div className="mb-3 flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>Discount ({currency})</span>
                        <input
                            type="number"
                            min={0}
                            value={discount || ''}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="ml-auto w-24 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                        />
                    </div>
                    <div className="space-y-1 text-xs mb-2" style={{ color: 'var(--ap-muted)' }}>
                        <div className="flex justify-between"><span>Subtotal</span><span>{currency}{cartSubtotal.toFixed(2)}</span></div>
                        {cartDiscount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{currency}{cartDiscount.toFixed(2)}</span></div>}
                        <div className="flex justify-between"><span>Tax ({taxRate}%)</span><span>{currency}{cartTax.toFixed(2)}</span></div>
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                        <span className="font-bold" style={{ color: 'var(--ap-input-text)' }}>Total</span>
                        <span className="text-xl font-bold" style={{ color: '#D4A843' }}>{currency}{cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={placeOrder}
                        disabled={cart.length === 0 || isSubmitting}
                        className="w-full rounded-full py-3.5 text-sm font-bold transition-all disabled:opacity-40"
                        style={{ background: '#2C1A0E', color: '#D4A843' }}
                    >
                        {isSubmitting ? 'Placing...' : `🛒 Place Order${cart.length > 0 ? ` (${cart.length})` : ''}`}
                    </button>
                </div>
            </div>

            {/* ── Item Modal ── */}
            <AnimatePresence>
                {itemModalOpen && selectedItem && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setItemModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 shadow-xl"
                            style={{ zIndex: 60, maxHeight: '80vh', background: 'var(--ap-card)' }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{selectedItem.name}</h2>
                                    {selectedItem.description && <p className="text-sm mt-0.5" style={{ color: 'var(--ap-muted)' }}>{selectedItem.description}</p>}
                                    <p className="mt-1 font-bold" style={{ color: '#D4A843' }}>
                                        {selectedItem.has_variations && !itemVariationId
                                            ? `From ${currency}${(selectedItem.display_price ?? selectedItem.price).toFixed(2)}`
                                            : `${currency}${itemBasePrice(selectedItem, itemVariationId).toFixed(2)}`}
                                    </p>
                                </div>
                                <button onClick={() => setItemModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>

                            {selectedItem.variations && selectedItem.variations.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ap-input-text)' }}>Size <span className="text-red-400">*</span></p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedItem.variations.map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => setItemVariationId(v.id)}
                                                className="flex flex-col items-center rounded-xl px-3 py-1.5 text-xs transition-all"
                                                style={{
                                                    background: itemVariationId === v.id ? '#FDF6EC' : 'var(--ap-bg)',
                                                    border: `2px solid ${itemVariationId === v.id ? '#D4A843' : 'var(--ap-border)'}`,
                                                    color: 'var(--ap-input-text)', minWidth: '60px',
                                                }}
                                            >
                                                <span className="font-medium">{v.name}</span>
                                                <span className="text-[10px]" style={{ color: '#D4A843' }}>{currency}{v.price.toFixed(2)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedItem.addon_groups.map((group) => (
                                <div key={group.id} className="mt-4">
                                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ap-input-text)' }}>
                                        {group.name} {group.is_required && <span className="text-red-400">*</span>}
                                        {group.max_selections > 1 && <span className="ml-1 text-xs" style={{ color: 'var(--ap-muted)' }}>(max {group.max_selections})</span>}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {group.addons.map((addon) => {
                                            const isSel = itemAddons[group.id]?.includes(addon.id);
                                            const priceLabel = addon.additional_price > 0 ? `+${currency}${addon.additional_price}` : addon.additional_price < 0 ? `-${currency}${Math.abs(addon.additional_price)}` : 'Free';
                                            return (
                                                <button
                                                    key={addon.id}
                                                    onClick={() => toggleAddon(group.id, addon.id, group.max_selections)}
                                                    className="flex flex-col items-center rounded-xl px-3 py-1.5 text-xs transition-all"
                                                    style={{
                                                        background: isSel ? '#FDF6EC' : 'var(--ap-bg)',
                                                        border: `2px solid ${isSel ? '#D4A843' : 'var(--ap-border)'}`,
                                                        color: 'var(--ap-input-text)', minWidth: '60px',
                                                    }}
                                                >
                                                    <span className="font-medium">{addon.name}</span>
                                                    <span className="text-[10px]" style={{ color: addon.additional_price !== 0 ? '#D4A843' : 'var(--ap-muted)' }}>{priceLabel}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            <div className="mt-4">
                                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ap-muted)' }}>Special instructions (optional)</label>
                                <input
                                    value={itemNotes}
                                    onChange={(e) => setItemNotes(e.target.value)}
                                    placeholder="e.g. less ice, extra hot..."
                                    className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                    style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                />
                            </div>

                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex items-center gap-2 rounded-full px-2" style={{ border: '1px solid var(--ap-border)' }}>
                                    <button onClick={() => setItemQty(Math.max(1, itemQty - 1))} className="p-1.5"><Minus className="h-4 w-4" style={{ color: 'var(--ap-input-text)' }} /></button>
                                    <span className="w-6 text-center font-bold" style={{ color: 'var(--ap-input-text)' }}>{itemQty}</span>
                                    <button onClick={() => setItemQty(itemQty + 1)} className="p-1.5"><Plus className="h-4 w-4" style={{ color: 'var(--ap-input-text)' }} /></button>
                                </div>
                                <button onClick={addToCart} disabled={!canAddToCart()} className="flex-1 rounded-full py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    Add to Order — {currency}{(itemBasePrice(selectedItem, itemVariationId) * itemQty).toFixed(2)}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Payment Modal ── */}
            <AnimatePresence>
                {paymentModalOpen && payingOrder && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setPaymentModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ zIndex: 60, background: 'var(--ap-card)' }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    <CreditCard className="h-5 w-5" style={{ color: '#D4A843' }} /> Payment
                                </h2>
                                <button onClick={() => setPaymentModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>

                            <div className="rounded-xl p-3 mb-4" style={{ background: '#2C1A0E' }}>
                                <p className="text-xs text-white/60">Order</p>
                                <p className="font-bold text-white" style={{ fontFamily: "'Space Mono', monospace" }}>{payingOrder.order_number}</p>
                                <p className="mt-1 text-2xl font-bold" style={{ color: '#D4A843' }}>{currency}{payingOrder.total.toFixed(2)}</p>
                            </div>

                            {/* Payment method */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {(['cash', 'card', 'gcash', 'maya'] as const).map((method) => (
                                    <button
                                        key={method}
                                        onClick={() => setPayMethod(method)}
                                        className="rounded-xl py-2 text-xs font-semibold capitalize transition-all"
                                        style={{
                                            background: payMethod === method ? '#2C1A0E' : 'var(--ap-bg)',
                                            color: payMethod === method ? '#D4A843' : 'var(--ap-muted)',
                                            border: `1px solid ${payMethod === method ? '#2C1A0E' : 'var(--ap-border)'}`,
                                        }}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>

                            {payMethod === 'cash' && (
                                <div>
                                    <label className="text-xs mb-1 block" style={{ color: 'var(--ap-muted)' }}>Cash received</label>
                                    <input
                                        type="number"
                                        value={cashReceived}
                                        onChange={(e) => setCashReceived(e.target.value)}
                                        placeholder={payingOrder.total.toFixed(2)}
                                        className="w-full rounded-xl px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                    {/* Quick amounts */}
                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                        {quickCashPresets(payingOrder.total).map((amt) => (
                                            <button
                                                key={amt}
                                                onClick={() => setCashReceived(String(amt))}
                                                className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all"
                                                style={{
                                                    background: cashReceived === String(amt) ? '#2C1A0E' : 'var(--ap-bg)',
                                                    color: cashReceived === String(amt) ? '#D4A843' : 'var(--ap-muted)',
                                                    border: `1px solid ${cashReceived === String(amt) ? '#2C1A0E' : 'var(--ap-border)'}`,
                                                }}
                                            >
                                                {amt === payingOrder.total ? 'Exact' : `${currency}${amt}`}
                                            </button>
                                        ))}
                                    </div>
                                    {cashReceived && parseFloat(cashReceived) >= payingOrder.total && (
                                        <p className="mt-2 text-sm font-semibold text-green-600">
                                            Change: {currency}{(parseFloat(cashReceived) - payingOrder.total).toFixed(2)}
                                        </p>
                                    )}
                                </div>
                            )}

                            {(['card', 'gcash', 'maya'] as const).includes(payMethod as 'card' | 'gcash' | 'maya') && (
                                <div>
                                    <label className="text-xs mb-1 block" style={{ color: 'var(--ap-muted)' }}>Reference number</label>
                                    <input
                                        type="text"
                                        value={referenceNo}
                                        onChange={(e) => setReferenceNo(e.target.value)}
                                        placeholder="Enter reference no."
                                        className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                </div>
                            )}

                            <button
                                onClick={processPayment}
                                disabled={isSubmitting}
                                className="mt-4 w-full rounded-full py-3 font-bold disabled:opacity-40"
                                style={{ background: '#D4A843', color: '#2C1A0E' }}
                            >
                                {isSubmitting ? 'Processing...' : '✓ Confirm Payment'}
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Receipt Modal ── */}
            <AnimatePresence>
                {receiptOrder && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50" style={{ zIndex: 50 }} onClick={() => setReceiptOrder(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-xs -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl"
                            style={{ zIndex: 60, background: 'var(--ap-card)' }}
                        >
                            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--ap-border)' }}>
                                <span className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>Receipt Ready</span>
                                <button onClick={() => setReceiptOrder(null)}><X className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <div className="max-h-96 overflow-y-auto bg-gray-50 p-4">
                                <div ref={receiptRef}>
                                    <ThermalReceipt order={receiptOrder} currency={currency} />
                                </div>
                            </div>
                            <div className="flex gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--ap-border)' }}>
                                <button onClick={() => setReceiptOrder(null)} className="flex-1 rounded-full py-2.5 text-sm font-medium" style={{ border: '1px solid var(--ap-border)', color: 'var(--ap-muted)' }}>
                                    Close
                                </button>
                                <button onClick={() => receiptRef.current && printReceipt(receiptRef.current)} className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                                    <Printer className="h-4 w-4" /> Print
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Customer Modal ── */}
            <AnimatePresence>
                {customerModalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setCustomerModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-xl"
                            style={{ zIndex: 60, background: 'var(--ap-card)' }}
                        >
                            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--ap-border)' }}>
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Select Customer</h2>
                                <button onClick={() => setCustomerModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <div className="flex" style={{ borderBottom: '1px solid var(--ap-border)' }}>
                                {(['search', 'new'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setCustomerTab(tab)}
                                        className="flex-1 py-2.5 text-sm font-semibold transition-colors"
                                        style={customerTab === tab ? { color: '#2C1A0E', borderBottom: '2px solid #D4A843' } : { color: 'var(--ap-muted)' }}
                                    >
                                        {tab === 'search' ? 'Search Existing' : 'Add New'}
                                    </button>
                                ))}
                            </div>
                            <div className="p-5">
                                {customerTab === 'search' ? (
                                    <div>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }} />
                                            <input
                                                autoFocus
                                                value={customerSearch}
                                                onChange={(e) => searchCustomers(e.target.value)}
                                                placeholder="Search by name, phone or email..."
                                                className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                            />
                                        </div>
                                        <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
                                            {customerSearching && <p className="py-4 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>Searching...</p>}
                                            {!customerSearching && customerSearch && customerResults.length === 0 && (
                                                <div className="py-6 text-center">
                                                    <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>No customers found.</p>
                                                    <button onClick={() => { setCustomerTab('new'); setNewCustomerName(customerSearch); }} className="mt-2 text-sm font-semibold" style={{ color: '#D4A843' }}>
                                                        <UserPlus className="mr-1 inline h-3.5 w-3.5" />Create "{customerSearch}"
                                                    </button>
                                                </div>
                                            )}
                                            {customerResults.map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { setSelectedCustomer(c); setCustomerModalOpen(false); }}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-amber-50"
                                                >
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: '#D4A843' }}>
                                                        {c.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>{c.name}</p>
                                                        <p className="truncate text-xs" style={{ color: 'var(--ap-muted)' }}>
                                                            {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}
                                                        </p>
                                                        {(c.points > 0 || c.cup_count > 0) && (
                                                            <p className="text-xs mt-0.5" style={{ color: '#D97706' }}>
                                                                {c.points > 0 && `★ ${c.points.toLocaleString()} pts`}
                                                                {c.points > 0 && c.cup_count > 0 && ' · '}
                                                                {c.cup_count > 0 && `☕ ${c.cup_count} cups`}
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Full Name *</label>
                                            <input autoFocus value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name" className="mt-1 w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Phone</label>
                                            <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="09171234567" className="mt-1 w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Email</label>
                                            <input type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} placeholder="customer@email.com" className="mt-1 w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                                        </div>
                                        <button onClick={saveNewCustomer} disabled={!newCustomerName.trim() || customerSaving} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                            {customerSaving ? 'Saving...' : 'Save & Select'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Void Modal ── */}
            <AnimatePresence>
                {voidingOrder && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setVoidingOrder(null)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ zIndex: 60, background: 'var(--ap-card)' }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg flex items-center gap-2" style={{ color: '#EF4444', fontFamily: "'Playfair Display', serif" }}>
                                    <Ban className="h-5 w-5" /> Void Order
                                </h2>
                                <button onClick={() => setVoidingOrder(null)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <p className="text-sm mb-4" style={{ color: 'var(--ap-muted)' }}>
                                Void <span className="font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Space Mono', monospace" }}>{voidingOrder.order_number}</span>?
                                This cannot be undone.
                            </p>
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ap-muted)' }}>Reason (optional)</label>
                                <textarea
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    placeholder="Enter reason..."
                                    rows={2}
                                    className="w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                    style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => setVoidingOrder(null)} className="flex-1 rounded-full py-2.5 text-sm font-medium" style={{ border: '1px solid var(--ap-border)', color: 'var(--ap-muted)' }}>
                                    Cancel
                                </button>
                                <button onClick={voidOrder} disabled={voidProcessing} className="flex-1 rounded-full py-2.5 text-sm font-bold disabled:opacity-40" style={{ background: '#EF4444', color: 'white' }}>
                                    {voidProcessing ? 'Voiding...' : 'Void Order'}
                                </button>
                            </div>
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
        voided: { bg: '#FEE2E2', text: '#991B1B' },
    };
    const c = colors[status] ?? { bg: '#F3F4F6', text: '#6B7280' };
    return (
        <span className="rounded-full px-2 py-0.5 text-xs capitalize" style={{ background: c.bg, color: c.text }}>
            {status}
        </span>
    );
}
