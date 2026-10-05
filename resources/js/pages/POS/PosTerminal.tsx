import { Head } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { Ban, ChefHat, Coffee, LayoutDashboard, Moon, Printer, Search, ShoppingBag, Sun, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { ActiveOrders } from '@/components/pos/active-orders';
import { CartPanel } from '@/components/pos/cart-panel';
import { CustomerDialog } from '@/components/pos/customer-dialog';
import { ItemDialog  } from '@/components/pos/item-dialog';
import type {ItemSelection} from '@/components/pos/item-dialog';
import { PaymentDialog  } from '@/components/pos/payment-dialog';
import type {PaymentSubmission} from '@/components/pos/payment-dialog';
import { StationOrders, stationOrders } from '@/components/pos/station-orders';
import type { CartItem, Category, Customer, MenuItem, Order, OrderType, PosSettings, TableOption } from '@/components/pos/types';
import { calculateTotals, apiRequest, formatMoney, lineKey, needsCustomization } from '@/components/pos/utils';
import { printReceipt, ThermalReceipt } from '@/components/thermal-receipt';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { posOrdersPayment, posOrdersStore, posOrdersUpdateStatus, posOrdersVoid } from '@/lib/routes';
import { cn } from '@/lib/utils';
import '../../echo';

interface Props {
    categories: Category[];
    tables: TableOption[];
    initialOrders: Order[];
    settings: PosSettings;
}

type ReceiptOrder = Order & { cashReceived?: number; change?: number; payMethod?: string };

const CLOSED_STATUSES = ['completed', 'cancelled', 'voided'];

export default function PosTerminal({ categories, tables, initialOrders, settings }: Props) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const [mounted, setMounted] = useState(false);
    // Appearance is only known client-side; avoids a hydration mismatch on the theme icon.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setMounted(true), []);

    const { currency, tax_rate: taxRate, pay_as_you_order: payAsYouOrder } = settings;

    const [view, setView] = useState<'menu' | 'kitchen' | 'barista'>('menu');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(categories[0]?.id ?? null);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // crypto.randomUUID is unavailable on non-HTTPS origins (e.g. a tablet on the LAN), so use a counter.
    const nextLineId = useRef(1);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [orderType, setOrderType] = useState<OrderType>('walkin');
    const [tableId, setTableId] = useState<number | null>(null);
    const [orderNotes, setOrderNotes] = useState('');
    const [discountValue, setDiscountValue] = useState(0);
    const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [customerOpen, setCustomerOpen] = useState(false);
    const [placing, setPlacing] = useState(false);

    const [activeOrders, setActiveOrders] = useState<Order[]>(initialOrders);
    const [ordersExpanded, setOrdersExpanded] = useState(true);
    const [itemInDialog, setItemInDialog] = useState<MenuItem | null>(null);

    const [payingOrder, setPayingOrder] = useState<Order | null>(null);
    const [paying, setPaying] = useState(false);
    const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    const [voidingOrder, setVoidingOrder] = useState<Order | null>(null);
    const [voidReason, setVoidReason] = useState('');
    const [voiding, setVoiding] = useState(false);

    const totals = useMemo(() => calculateTotals(cart, discountValue, discountMode, taxRate), [cart, discountValue, discountMode, taxRate]);
    const cartCount = cart.reduce((n, i) => n + i.quantity, 0);
    const qtyByMenuItem = useMemo(() => {
        const map = new Map<number, number>();
        cart.forEach((i) => map.set(i.menuItem.id, (map.get(i.menuItem.id) ?? 0) + i.quantity));

        return map;
    }, [cart]);

    const kitchenCount = stationOrders(activeOrders, 'kitchen').length;
    const baristaCount = stationOrders(activeOrders, 'barista').length;

    const query = searchQuery.trim().toLowerCase();
    const displayItems = useMemo(() => {
        if (query) {
 return categories.flatMap((c) => c.menu_items).filter((i) => i.name.toLowerCase().includes(query)); 
}

        return categories.find((c) => c.id === activeCategoryId)?.menu_items ?? [];
    }, [categories, activeCategoryId, query]);

    // Live kitchen sync: de-duplicate so an order is never listed twice.
    useEffect(() => {
        const echo = (window as unknown as { Echo?: any }).Echo;

        if (!echo) {
 return; 
}

        echo.channel('kitchen')
            .listen('.order.placed', (e: { order: Order }) =>
                setActiveOrders((prev) => (prev.some((o) => o.id === e.order.id) ? prev : [e.order, ...prev])))
            .listen('.status.updated', (e: { order: Order }) =>
                setActiveOrders((prev) => CLOSED_STATUSES.includes(e.order.status)
                    ? prev.filter((o) => o.id !== e.order.id)
                    : prev.map((o) => (o.id === e.order.id ? { ...o, ...e.order, payment: e.order.payment ?? o.payment } : o))));

        return () => echo.leaveChannel('kitchen');
    }, []);

    // "/" jumps to search, like most POS/search UIs.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;

            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
 e.preventDefault(); searchRef.current?.focus(); 
}
        };
        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, []);

    function addLine(line: Omit<CartItem, 'id'>) {
        const key = lineKey(line);
        setCart((prev) => {
            const existing = prev.find((i) => lineKey(i) === key);

            if (existing) {
 return prev.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + line.quantity } : i)); 
}

            return [...prev, { ...line, id: `line-${nextLineId.current++}` }];
        });
        toast.success(`${line.menuItem.name} added`, { duration: 1200 });
    }

    function onItemTap(item: MenuItem) {
        if (needsCustomization(item)) {
 setItemInDialog(item);

 return; 
}

        addLine({ menuItem: item, quantity: 1, selectedVariation: null, selectedAddons: [], notes: '', unitPrice: Number(item.display_price ?? item.price) });
    }

    function onItemConfirmed(s: ItemSelection) {
        addLine({
            menuItem: s.item, quantity: s.quantity, notes: s.notes.trim(), unitPrice: s.unitPrice, selectedAddons: s.addons,
            selectedVariation: s.item.variations?.find((v) => v.id === s.variationId) ?? null,
        });
        setItemInDialog(null);
    }

    function changeQuantity(id: string, delta: number) {
        setCart((prev) => prev.flatMap((i) => {
            if (i.id !== id) {
 return [i]; 
}

            return i.quantity + delta < 1 ? [] : [{ ...i, quantity: i.quantity + delta }];
        }));
    }

    function clearCart() {
        setCart([]); setOrderNotes(''); setDiscountValue(0); setCustomer(null); setTableId(null);
    }

    async function placeOrder() {
        if (cart.length === 0 || placing || (orderType === 'dine-in' && !tableId)) {
 return; 
}

        setPlacing(true);

        try {
            const data = await apiRequest<{ order: Order }>(posOrdersStore(), 'POST', {
                table_id: orderType === 'dine-in' ? tableId : null,
                customer_id: customer?.id ?? null,
                type: orderType, notes: orderNotes, discount: totals.discount,
                items: cart.map((i) => ({
                    menu_item_id: i.menuItem.id, variation_id: i.selectedVariation?.id ?? null,
                    quantity: i.quantity, notes: i.notes, addon_ids: i.selectedAddons.map((a) => a.id),
                })),
            });
            setActiveOrders((prev) => [data.order, ...prev.filter((o) => o.id !== data.order.id)]);
            clearCart();
            setCartOpen(false);
            toast.success(`Order ${data.order.order_number} placed`);

            if (payAsYouOrder) {
 setPayingOrder(data.order); 
}
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setPlacing(false);
        }
    }

    async function submitPayment(payment: PaymentSubmission) {
        if (!payingOrder) {
 return; 
}

        setPaying(true);

        try {
            const data = await apiRequest<{ order: Order }>(posOrdersPayment(payingOrder.id), 'POST', {
                amount: payment.amount, method: payment.method, reference_no: payment.referenceNo,
            });
            // Paying does not close the order; it stays in the list and moves through its own steps.
            setActiveOrders((prev) => prev.map((o) => (o.id === payingOrder.id ? { ...o, ...data.order } : o)));
            setPayingOrder(null);
            toast.success('Payment recorded');
            setReceipt({
                ...data.order, payMethod: payment.method,
                cashReceived: payment.method === 'cash' ? payment.amount : undefined,
                change: payment.method === 'cash' ? Math.max(0, payment.amount - data.order.total) : undefined,
            });
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setPaying(false);
        }
    }

    async function advanceOrder(order: Order, status: string) {
        try {
            const data = await apiRequest<{ order: Order }>(posOrdersUpdateStatus(order.id), 'PATCH', { status });
            setActiveOrders((prev) => CLOSED_STATUSES.includes(status)
                ? prev.filter((o) => o.id !== order.id)
                : prev.map((o) => (o.id === order.id ? { ...data.order, payment: data.order.payment ?? o.payment } : o)));
        } catch (e) {
            toast.error((e as Error).message);
        }
    }

    async function voidOrder() {
        if (!voidingOrder) {
 return; 
}

        setVoiding(true);

        try {
            await apiRequest(posOrdersVoid(voidingOrder.id), 'POST', { void_reason: voidReason });
            setActiveOrders((prev) => prev.filter((o) => o.id !== voidingOrder.id));
            setVoidingOrder(null); setVoidReason('');
            toast.success('Order voided');
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setVoiding(false);
        }
    }

    return (
        <div className="admin-panel flex h-dvh overflow-hidden" style={{ background: 'var(--ap-bg)', fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="POS" />
            <Toaster position="top-center" />

            {/* ── Menu side ── */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex shrink-0 items-center gap-3 bg-primary px-4 py-3">
                    <a href="/admin" className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-white/10" title="Back to dashboard" aria-label="Back to dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                    </a>
                    <h1 className="hidden text-lg font-bold text-primary-foreground sm:block" style={{ fontFamily: "'Playfair Display', serif" }}>POS Terminal</h1>
                    <div className={cn('relative ml-auto w-full max-w-xs', view !== 'menu' && 'invisible')}>
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-primary-foreground/50" />
                        <input
                            ref={searchRef} type="search" placeholder="Search menu  ( / )" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
                            aria-label="Search menu"
                            className="h-10 w-full rounded-full bg-white/10 pr-9 pl-9 text-sm text-primary-foreground placeholder-primary-foreground/50 focus:ring-1 focus:ring-white/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} aria-label="Clear search" className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-white/10">
                                <X className="h-3.5 w-3.5 text-primary-foreground/70" />
                            </button>
                        )}
                    </div>
                    {mounted && (
                        <button onClick={() => updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground transition-colors hover:bg-white/10">
                            {resolvedAppearance === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>
                    )}
                </header>

                <div role="tablist" aria-label="POS views" className="flex shrink-0 gap-1 border-b border-[var(--ap-border)] bg-card px-3 pt-2">
                    {([
                        ['menu', 'Menu', UtensilsCrossed, null],
                        ['kitchen', 'Kitchen', ChefHat, kitchenCount],
                        ['barista', 'Barista', Coffee, baristaCount],
                    ] as const).map(([id, label, Icon, count]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={view === id}
                            onClick={() => setView(id)}
                            className={cn(
                                'flex h-11 items-center gap-2 rounded-t-xl border-b-2 px-4 text-sm font-semibold transition-colors',
                                view === id ? 'border-primary bg-primary/5 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                            {count !== null && (
                                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {view === 'menu' && !query && (
                    <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--ap-border)] bg-card px-3 py-2.5" aria-label="Menu categories">
                        {categories.map((cat) => (
                            <button
                                key={cat.id} onClick={() => setActiveCategoryId(cat.id)}
                                className={cn('flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-all',
                                    activeCategoryId === cat.id ? 'border-transparent bg-primary text-primary-foreground' : 'border-[var(--ap-border)] bg-[var(--ap-bg)] text-muted-foreground hover:text-foreground')}
                            >
                                <span>{cat.icon}</span><span>{cat.name}</span>
                            </button>
                        ))}
                    </nav>
                )}

                <main className="flex-1 overflow-y-auto p-3 pb-24 lg:pb-3">
                    {view !== 'menu' ? (
                        <StationOrders station={view} orders={activeOrders} />
                    ) : (
                    <>
                    {query && <p className="mb-2 text-xs text-muted-foreground">{displayItems.length} result{displayItems.length === 1 ? '' : 's'} for "{searchQuery.trim()}"</p>}
                    {displayItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Coffee className="mb-3 h-12 w-12 opacity-20" />
                            <p className="text-sm">{query ? 'No items match your search.' : 'No items in this category.'}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {displayItems.map((item) => {
                                const inCart = qtyByMenuItem.get(item.id) ?? 0;

                                return (
                                    <motion.button
                                        key={item.id} whileTap={{ scale: 0.97 }} onClick={() => onItemTap(item)}
                                        className="relative overflow-hidden rounded-xl border border-[var(--ap-border)] bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                                    >
                                        <div className="flex h-24 items-center justify-center overflow-hidden bg-muted">
                                            {item.image_url ? <img src={item.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-3xl">☕</span>}
                                        </div>
                                        {inCart > 0 && (
                                            <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow">{inCart}</span>
                                        )}
                                        <div className="p-2.5">
                                            <p className="line-clamp-2 min-h-9 text-sm leading-tight font-semibold text-foreground">{item.name}</p>
                                            <p className="mt-1 flex items-center justify-between text-sm font-bold text-primary">
                                                <span>{item.has_variations ? 'From ' : ''}{formatMoney(currency, Number(item.display_price ?? item.price))}</span>
                                                {needsCustomization(item) && <span className="text-[10px] font-medium text-muted-foreground">Options</span>}
                                            </p>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                    </>
                    )}
                </main>

                <ActiveOrders
                    orders={activeOrders} currency={currency} expanded={ordersExpanded} onToggle={() => setOrdersExpanded((v) => !v)}
                    onAdvance={advanceOrder} onPay={setPayingOrder} onVoid={(o) => {
 setVoidingOrder(o); setVoidReason(''); 
}}
                />
            </div>

            {/* ── Order panel: sidebar on desktop, full-screen sheet on tablets/phones ── */}
            <aside className={cn('z-40 w-full shrink-0 border-l border-[var(--ap-border)] lg:static lg:block lg:w-96', cartOpen ? 'fixed inset-0 block' : 'hidden')}>
                <CartPanel
                    cart={cart} currency={currency} taxRate={taxRate} totals={totals}
                    orderType={orderType} onOrderType={setOrderType} tables={tables} tableId={tableId} onTable={setTableId}
                    customer={customer} onPickCustomer={() => setCustomerOpen(true)} onClearCustomer={() => setCustomer(null)}
                    notes={orderNotes} onNotes={setOrderNotes}
                    discountValue={discountValue} discountMode={discountMode} onDiscount={(v, m) => {
 setDiscountValue(v); setDiscountMode(m); 
}}
                    onQuantity={changeQuantity} onRemove={(id) => setCart((prev) => prev.filter((i) => i.id !== id))} onClear={clearCart}
                    onSubmit={placeOrder} submitting={placing} payAsYouOrder={payAsYouOrder} onClose={() => setCartOpen(false)}
                />
            </aside>

            {!cartOpen && cartCount > 0 && (
                <button onClick={() => setCartOpen(true)} className="fixed right-4 bottom-4 left-4 z-30 flex h-14 items-center justify-between rounded-2xl bg-primary px-5 text-primary-foreground shadow-lg lg:hidden">
                    <span className="flex items-center gap-2 font-semibold"><ShoppingBag className="h-5 w-5" />View order · {cartCount}</span>
                    <span className="text-lg font-bold">{formatMoney(currency, totals.total)}</span>
                </button>
            )}

            <ItemDialog item={itemInDialog} currency={currency} onClose={() => setItemInDialog(null)} onAdd={onItemConfirmed} />
            <PaymentDialog order={payingOrder} currency={currency} submitting={paying} onClose={() => setPayingOrder(null)} onSubmit={submitPayment} />
            <CustomerDialog open={customerOpen} onOpenChange={setCustomerOpen} onSelect={setCustomer} />

            <CrudModal
                open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)} title="Payment complete" className="max-w-xs" contentClassName="bg-muted/40 p-4"
                footer={
                    <>
                        <Button variant="outline" className="h-11 flex-1" onClick={() => setReceipt(null)}>Done</Button>
                        <Button className="h-11 flex-1" onClick={() => receiptRef.current && printReceipt(receiptRef.current)}><Printer className="h-4 w-4" /> Print</Button>
                    </>
                }
            >
                {receipt && <div ref={receiptRef}><ThermalReceipt order={receipt} currency={currency} /></div>}
            </CrudModal>

            <CrudModal
                open={!!voidingOrder} onOpenChange={(open) => !open && setVoidingOrder(null)} className="max-w-sm"
                title={<span className="flex items-center gap-2 text-error"><Ban className="h-5 w-5" /> Void Order</span>}
                footer={
                    <>
                        <Button variant="outline" className="h-11 flex-1" onClick={() => setVoidingOrder(null)}>Keep order</Button>
                        <Button variant="destructive" className="h-11 flex-1" onClick={voidOrder} disabled={voiding}>{voiding ? 'Voiding...' : 'Void Order'}</Button>
                    </>
                }
            >
                {voidingOrder && (
                    <>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Void <span className="font-bold text-foreground" style={{ fontFamily: "'Space Mono', monospace" }}>{voidingOrder.order_number}</span>? This cannot be undone.
                        </p>
                        <FormField label="Reason (optional)">
                            <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Enter reason..." rows={2} className={adminFieldClass() + ' resize-none'} />
                        </FormField>
                    </>
                )}
            </CrudModal>
        </div>
    );
}
