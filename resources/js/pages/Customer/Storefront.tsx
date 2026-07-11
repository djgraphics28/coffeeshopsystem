import { Head, router, usePage } from '@inertiajs/react';
import { customerAuthLogin, customerAuthLogout, customerAuthRegister, customerPromoApply, storefrontOrdersShow, storefrontOrdersStore } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Minus, Plus, Search, ShoppingCart, Tag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import CustomerNav from '@/components/CustomerNav';

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
    is_featured: boolean;
    addon_groups: AddonGroup[];
}

interface Category {
    id: number;
    name: string;
    icon: string;
    menu_items: MenuItem[];
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

interface CustomerAuth {
    customer: { id: number; name: string; email: string; points: number; cup_count: number; free_drinks_available: number } | null;
    active_order: { id: number; order_number: string; status: string } | null;
}

interface Props {
    table: { id: number; name: string; qr_token: string } | null;
    categories: Category[];
    featured_items: MenuItem[];
    settings: {
        cafe_name: string;
        cafe_tagline: string;
        currency: string;
        estimated_wait_minutes: string;
        points_earn_rate: string;
        points_redeem_rate: string;
        loyalty_cups_enabled: boolean;
        loyalty_cups_threshold: number;
        delivery_fee: number;
        free_delivery_minimum: number;
        gcash_number: string | null;
        gcash_account_name: string | null;
        gcash_qr_url: string | null;
        maya_number: string | null;
        maya_account_name: string | null;
        maya_qr_url: string | null;
    };
}

/* Retro-geometric palette (cream / navy / terracotta / caramel) */
const P = {
    cream: '#E4DACB',
    creamLight: '#EFE8DC',
    navy: '#232B4A',
    navyDeep: '#1B2240',
    terracotta: '#C05B2D',
    caramel: '#B5824F',
    espresso: '#3B2A1D',
    sand: '#D8CBB8',
};

export default function Storefront({ table, categories, featured_items, settings }: Props) {
    const { customer_auth } = usePage().props as unknown as { customer_auth: CustomerAuth };
    const customer = customer_auth?.customer ?? null;
    const activeOrder = customer_auth?.active_order ?? null;

    const [activeCategory, setActiveCategory] = useState<number | null>(categories[0]?.id ?? null);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const cartStorageKey = `storefront_cart_${table?.qr_token ?? 'browse'}`;
    // Start empty on both server and client so SSR hydration matches, then
    // restore the persisted cart after mount (this effect must be registered
    // before the persist effect below so it reads storage before it's rewritten).
    const [cart, setCart] = useState<CartItem[]>([]);
    useEffect(() => {
        try {
            const stored = JSON.parse(sessionStorage.getItem(cartStorageKey) ?? '[]') as CartItem[];
            if (stored.length > 0) setCart(stored);
        } catch {
            // Corrupt or unavailable storage — start with an empty cart
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cartStorageKey]);
    const [cartOpen, setCartOpen] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);
    const [selectedAddons, setSelectedAddons] = useState<Record<number, number[]>>({});
    const [itemNotes, setItemNotes] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [authPromptOpen, setAuthPromptOpen] = useState(false);

    // Online (table-less) order state: fulfillment, delivery location, payment
    const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'gcash' | 'maya'>('cod');
    const [paymentProof, setPaymentProof] = useState<File | null>(null);

    // Object URL for previewing the selected proof image; revoked on change/unmount
    const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!paymentProof) {
            setProofPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(paymentProof);
        setProofPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [paymentProof]);

    // Promo & points state
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number; message: string } | null>(null);
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);
    const [redeemPoints, setRedeemPoints] = useState(false);

    // Loyalty cups — local mirrors updated after order response
    const [cupCount, setCupCount] = useState(customer?.cup_count ?? 0);
    const [freeDrinksAvailable, setFreeDrinksAvailable] = useState(customer?.free_drinks_available ?? 0);
    const [useFreeDrink, setUseFreeDrink] = useState(false);

    // Keep the cart across sign-in/register redirects
    useEffect(() => {
        try {
            if (typeof sessionStorage === 'undefined') return;
            sessionStorage.setItem(cartStorageKey, JSON.stringify(cart));
        } catch {
            // Storage unavailable (private mode) — cart just won't survive navigation
        }
    }, [cart, cartStorageKey]);

    const categoryRefs = useRef<Record<number, HTMLElement | null>>({});
    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const menuStartRef = useRef<HTMLDivElement>(null);

    const currency = settings.currency;
    const earnRate = parseFloat(settings.points_earn_rate ?? '1');
    const redeemRate = parseFloat(settings.points_redeem_rate ?? '100');

    const allItems = categories.flatMap((c) => c.menu_items);
    const filteredItems = searchQuery
        ? allItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : null;

    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const promoDiscount = promoApplied?.discount ?? 0;
    const pointsDiscount = redeemPoints && customer
        ? Math.min(Math.floor(customer.points / redeemRate * 100) / 100, cartSubtotal - promoDiscount)
        : 0;
    const cheapestItemPrice = cart.length > 0
        ? Math.min(...cart.map((i) => i.unitPrice))
        : 0;
    const freeDrinkDiscount = useFreeDrink && freeDrinksAvailable > 0 ? cheapestItemPrice : 0;

    // Delivery fee — waived once the subtotal reaches the free-delivery minimum
    const deliveryFeeApplies = !table && fulfillment === 'delivery' && settings.delivery_fee > 0;
    const qualifiesFreeDelivery = settings.free_delivery_minimum > 0 && cartSubtotal >= settings.free_delivery_minimum;
    const deliveryFee = deliveryFeeApplies && !qualifiesFreeDelivery ? settings.delivery_fee : 0;
    const amountToFreeDelivery = Math.max(0, settings.free_delivery_minimum - cartSubtotal);

    const cartTotal = Math.max(0, cartSubtotal - promoDiscount - pointsDiscount - freeDrinkDiscount) + deliveryFee;

    function scrollToCategory(categoryId: number) {
        setActiveCategory(categoryId);
        const el = categoryRefs.current[categoryId];
        if (!el) return;
        const offset = stickyHeaderRef.current?.offsetHeight ?? 0;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    }

    function scrollToMenu() {
        const el = menuStartRef.current;
        if (!el) return;
        const offset = stickyHeaderRef.current?.offsetHeight ?? 0;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    }

    function openItem(item: MenuItem) {
        setSelectedItem(item);
        setQuantity(1);
        setSelectedVariationId(item.variations?.[0]?.id ?? null);
        setSelectedAddons({});
        setItemNotes('');
    }

    function toggleAddon(groupId: number, addonId: number, maxSelections: number) {
        setSelectedAddons((prev) => {
            const current = prev[groupId] ?? [];
            if (current.includes(addonId)) {
                return { ...prev, [groupId]: current.filter((id) => id !== addonId) };
            }
            if (maxSelections === 1) {
                return { ...prev, [groupId]: [addonId] };
            }
            if (current.length < maxSelections) {
                return { ...prev, [groupId]: [...current, addonId] };
            }
            return prev;
        });
    }

    function computeUnitPrice(item: MenuItem, variationId: number | null, addons: Record<number, number[]>): number {
        const basePrice = variationId
            ? item.variations?.find((v) => v.id === variationId)?.price ?? item.price
            : item.display_price ?? item.price;
        const addonPrice = Object.values(addons)
            .flat()
            .reduce((sum, addonId) => {
                const addon = item.addon_groups.flatMap((g) => g.addons).find((a) => a.id === addonId);
                return sum + (addon?.additional_price ?? 0);
            }, 0);
        return basePrice + addonPrice;
    }

    function canAddToCart(): boolean {
        if (!selectedItem) return false;
        if (selectedItem.has_variations && !selectedVariationId) return false;
        for (const group of selectedItem.addon_groups) {
            if (group.is_required && !(selectedAddons[group.id]?.length > 0)) {
                return false;
            }
        }
        return true;
    }

    function addToCart() {
        if (!selectedItem || !canAddToCart()) return;

        const flatAddons = Object.values(selectedAddons)
            .flat()
            .map((id) => selectedItem.addon_groups.flatMap((g) => g.addons).find((a) => a.id === id)!)
            .filter(Boolean);

        const selectedVariation = selectedItem.variations?.find((v) => v.id === selectedVariationId) ?? null;
        const unitPrice = computeUnitPrice(selectedItem, selectedVariationId, selectedAddons);
        const cartItem: CartItem = {
            id: `${selectedItem.id}-${Date.now()}`,
            menuItem: selectedItem,
            quantity,
            selectedVariation,
            selectedAddons: flatAddons,
            notes: itemNotes,
            unitPrice,
            subtotal: unitPrice * quantity,
        };

        setCart((prev) => [...prev, cartItem]);
        setSelectedItem(null);
        toast.success(`${selectedItem.name} added to cart`);
    }

    function removeFromCart(id: string) {
        setCart((prev) => prev.filter((item) => item.id !== id));
    }

    function updateCartItemQuantity(id: string, delta: number) {
        setCart((prev) =>
            prev
                .map((item) =>
                    item.id === id
                        ? { ...item, quantity: item.quantity + delta, subtotal: item.unitPrice * (item.quantity + delta) }
                        : item,
                )
                .filter((item) => item.quantity > 0),
        );
    }

    async function applyPromo() {
        if (!promoCode.trim()) return;
        if (!customer) {
            setAuthPromptOpen(true);
            return;
        }
        setIsApplyingPromo(true);
        try {
            const res = await fetch(customerPromoApply(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' },
                body: JSON.stringify({ code: promoCode, subtotal: cartSubtotal }),
            });
            const data = await res.json();
            if (data.valid) {
                setPromoApplied({ code: promoCode.toUpperCase(), discount: data.discount_amount, message: data.message });
                toast.success(data.message);
            } else {
                setPromoApplied(null);
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to apply promo.');
        } finally {
            setIsApplyingPromo(false);
        }
    }

    function useCurrentLocation() {
        if (!navigator.geolocation) {
            toast.error('Location is not supported by your browser.');
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setDeliveryCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setIsLocating(false);
                toast.success('Location pinned!');
            },
            (err) => {
                setIsLocating(false);
                if (err.code === err.PERMISSION_DENIED) {
                    toast.error('Location permission was denied. Please allow location access in your browser, or type your address instead.');
                } else {
                    toast.error('Could not get your location. Please type your address instead.');
                }
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }

    async function placeOrder() {
        if (cart.length === 0) return;

        if (!customer) {
            setAuthPromptOpen(true);
            return;
        }

        if (!table) {
            if (fulfillment === 'delivery' && !deliveryAddress.trim()) {
                toast.error('Please enter your delivery address or pin your location.');
                return;
            }
            if ((paymentMethod === 'gcash' || paymentMethod === 'maya') && !paymentProof) {
                toast.error('Please upload your proof of payment.');
                return;
            }
        }

        setIsPlacingOrder(true);

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            let response: Response;

            if (table) {
                // Dine-in: JSON request, unchanged
                response = await fetch(storefrontOrdersStore(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                    body: JSON.stringify({
                        table_id: table.id,
                        type: 'dine-in',
                        notes: orderNotes,
                        promo_code: promoApplied?.code ?? null,
                        redeem_points: redeemPoints && customer ? true : false,
                        use_free_drink: useFreeDrink && freeDrinksAvailable > 0,
                        items: cart.map((item) => ({
                            menu_item_id: item.menuItem.id,
                            variation_id: item.selectedVariation?.id ?? null,
                            quantity: item.quantity,
                            notes: item.notes,
                            addon_ids: item.selectedAddons.map((a) => a.id),
                        })),
                    }),
                });
            } else {
                // Online order: multipart form so the payment proof file can be uploaded
                const formData = new FormData();
                formData.append('type', fulfillment);
                formData.append('payment_method', paymentMethod);
                if (paymentProof) formData.append('payment_proof', paymentProof);
                if (fulfillment === 'delivery') {
                    formData.append('delivery_address', deliveryAddress);
                    if (deliveryCoords) {
                        formData.append('delivery_lat', String(deliveryCoords.lat));
                        formData.append('delivery_lng', String(deliveryCoords.lng));
                    }
                }
                formData.append('notes', orderNotes);
                if (promoApplied) formData.append('promo_code', promoApplied.code);
                formData.append('redeem_points', redeemPoints ? '1' : '0');
                formData.append('use_free_drink', useFreeDrink && freeDrinksAvailable > 0 ? '1' : '0');
                cart.forEach((item, i) => {
                    formData.append(`items[${i}][menu_item_id]`, String(item.menuItem.id));
                    formData.append(`items[${i}][quantity]`, String(item.quantity));
                    if (item.selectedVariation) formData.append(`items[${i}][variation_id]`, String(item.selectedVariation.id));
                    if (item.notes) formData.append(`items[${i}][notes]`, item.notes);
                    item.selectedAddons.forEach((addon, j) => {
                        formData.append(`items[${i}][addon_ids][${j}]`, String(addon.id));
                    });
                });

                response = await fetch(storefrontOrdersStore(), {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                    body: formData,
                });
            }

            if (response.status === 401) {
                setAuthPromptOpen(true);
                return;
            }
            if (response.status === 403) {
                const err = await response.json().catch(() => null);
                toast.error(err?.message ?? 'Unable to place order.');
                return;
            }
            if (response.status === 422) {
                const err = await response.json().catch(() => null);
                const firstError = err?.errors ? (Object.values(err.errors)[0] as string[])[0] : null;
                toast.error(firstError ?? err?.message ?? 'Please check your order details.');
                return;
            }
            if (!response.ok) throw new Error('Order failed');
            const data = await response.json();
            if (data.points_earned) {
                toast.success(`⭐ You earned ${data.points_earned} points!`);
            }
            if (data.free_drinks_earned > 0) {
                setTimeout(() => toast.success(`🎉 You earned ${data.free_drinks_earned} free drink${data.free_drinks_earned > 1 ? 's' : ''}!`), 600);
            }
            if (data.cups_awarded > 0 && data.free_drinks_earned === 0) {
                const newCount = data.cup_count ?? 0;
                const threshold = settings.loyalty_cups_threshold;
                setTimeout(() => toast(`☕ ${newCount}/${threshold} cups — ${threshold - newCount} more for a free drink!`, { icon: '☕' }), 400);
            }

            // Sync local cup state
            if (data.cup_count !== null && data.cup_count !== undefined) setCupCount(data.cup_count);
            if (data.free_drinks_available !== null && data.free_drinks_available !== undefined) setFreeDrinksAvailable(data.free_drinks_available);

            setCart([]);
            setCartOpen(false);
            setPromoApplied(null);
            setPromoCode('');
            setRedeemPoints(false);
            setUseFreeDrink(false);
            setDeliveryAddress('');
            setDeliveryCoords(null);
            setPaymentProof(null);
            router.visit(storefrontOrdersShow(data.order.id));
        } catch {
            toast.error('Failed to place order. Please try again.');
        } finally {
            setIsPlacingOrder(false);
        }
    }

    return (
        <div className="customer-page min-h-screen" style={{ background: P.cream, fontFamily: "'DM Sans', sans-serif", color: P.espresso }}>
            <Head title={`${settings.cafe_name} — Order`} />
            <Toaster position="top-center" />

            {/* ─── Top Nav ─────────────────────────────────────────── */}
            <div ref={stickyHeaderRef} className="sticky top-0 z-30 shadow-md" style={{ background: P.navy }}>
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
                    <CafeLogo name={settings.cafe_name} />

                    {/* Search */}
                    <div className="relative ml-auto w-40 sm:w-64 md:w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: P.sand }} />
                        <input
                            type="text"
                            placeholder="Search menu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2"
                            style={{ background: 'rgba(255,255,255,0.12)', '--tw-ring-color': P.terracotta } as React.CSSProperties}
                        />
                    </div>

                    {table && (
                        <div className="hidden shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white sm:block" style={{ background: P.terracotta }}>
                            {table.name}
                        </div>
                    )}

                    {customer && (
                        <form action={customerAuthLogout()} method="POST" className="shrink-0">
                            <input type="hidden" name="_token" value={typeof document !== 'undefined' ? (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '') : ''} />
                            <button type="submit" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                <LogOut className="h-3 w-3" />
                                <span className="hidden sm:inline">{customer.name.split(' ')[0]}</span>
                            </button>
                        </form>
                    )}
                </div>

                {/* Category tabs (inside sticky bar so they're always reachable) */}
                {!searchQuery && (
                    <div className="border-t border-white/10">
                        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2 sm:px-6" style={{ scrollbarWidth: 'none' }}>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => scrollToCategory(cat.id)}
                                    className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
                                    style={{
                                        background: activeCategory === cat.id ? P.terracotta : 'rgba(255,255,255,0.08)',
                                        color: 'white',
                                    }}
                                >
                                    <span>{cat.icon}</span>
                                    <span>{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Active order banner (back-navigation safety net) ── */}
            {activeOrder && (
                <button
                    onClick={() => router.visit(storefrontOrdersShow(activeOrder.id))}
                    className="block w-full px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-white"
                    style={{ background: P.terracotta }}
                >
                    ☕ Order {activeOrder.order_number} is {activeOrder.status} — tap to track →
                </button>
            )}

            {/* ─── Hero (retro-geometric) ──────────────────────────── */}
            {!searchQuery && (
                <div className="relative overflow-hidden" style={{ background: P.cream }}>
                    <GeometricShapes />
                    <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 text-center sm:py-16 md:flex-row md:py-20 md:text-left">
                        <div className="md:flex-1">
                            <h1
                                className="text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl md:text-6xl"
                                style={{ color: P.espresso, fontFamily: "'DM Sans', sans-serif" }}
                            >
                                {settings.cafe_name}
                            </h1>
                            <p className="mt-3 text-xl sm:text-2xl" style={{ color: P.espresso, fontFamily: "'Playfair Display', serif" }}>
                                {settings.cafe_tagline}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                                {customer && (
                                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: P.caramel }}>
                                        ⭐ {customer.points} pts
                                    </span>
                                )}
                                {settings.loyalty_cups_enabled && customer && (
                                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: P.navy }}>
                                        ☕ {cupCount}/{settings.loyalty_cups_threshold} cups
                                    </span>
                                )}
                                {settings.loyalty_cups_enabled && customer && freeDrinksAvailable > 0 && (
                                    <motion.span
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="rounded-full px-3 py-1 text-xs font-bold text-white"
                                        style={{ background: P.terracotta }}
                                    >
                                        🎁 {freeDrinksAvailable} free drink{freeDrinksAvailable > 1 ? 's' : ''}!
                                    </motion.span>
                                )}
                                {table && (
                                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white sm:hidden" style={{ background: P.terracotta }}>
                                        {table.name}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={scrollToMenu}
                                className="mt-6 px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-105"
                                style={{ background: P.navy }}
                            >
                                Order Now
                            </button>
                        </div>

                        {/* Coffee cup illustration */}
                        <div className="hidden shrink-0 md:block">
                            <CoffeeCupIllustration />
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Main Content ────────────────────────────────────── */}
            <div className="mx-auto max-w-6xl px-4 pb-32 sm:px-6" ref={menuStartRef}>
                {/* Featured */}
                {!searchQuery && featured_items.length > 0 && (
                    <div className="pt-8">
                        <SectionHeading label="Staff Picks" />
                        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible lg:grid-cols-5" style={{ scrollbarWidth: 'none' }}>
                            {featured_items.map((item) => (
                                <FeaturedCard key={item.id} item={item} currency={currency} onSelect={openItem} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Results */}
                {searchQuery && (
                    <div className="pt-6">
                        <p className="mb-4 text-sm" style={{ color: P.caramel }}>
                            {filteredItems?.length ?? 0} results for "{searchQuery}"
                        </p>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {(filteredItems ?? []).map((item) => (
                                <MenuCard key={item.id} item={item} currency={currency} onSelect={openItem} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Category Sections */}
                {!searchQuery &&
                    categories.map((cat) => (
                        <div
                            key={cat.id}
                            ref={(el) => {
                                categoryRefs.current[cat.id] = el;
                            }}
                            className="pt-10"
                        >
                            <SectionHeading label={`${cat.icon} ${cat.name}`} />
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                {cat.menu_items.map((item) => (
                                    <MenuCard key={item.id} item={item} currency={currency} onSelect={openItem} />
                                ))}
                            </div>
                        </div>
                    ))}

                {/* While You Wait */}
                {!searchQuery && (
                    <div className="mt-12 overflow-hidden rounded-none p-6 sm:p-8 md:flex md:items-center md:gap-8" style={{ background: P.navy, color: 'white' }}>
                        <div className="md:flex-1">
                            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: P.cream }}>
                                While you wait...
                            </h2>
                            <p className="mt-2 text-sm text-white/70">Watch our baristas craft your drink with love ☕</p>
                        </div>
                        <iframe
                            className="mt-4 w-full md:mt-0 md:w-[420px]"
                            height="220"
                            src="https://www.youtube.com/embed/5WCB5BbdxFI"
                            title="Coffee crafting"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                )}
            </div>

            {/* ─── Floating Cart Button ────────────────────────────── */}
            {cartItemCount > 0 && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setCartOpen(true)}
                    className="fixed bottom-20 right-4 flex items-center gap-2 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-xl sm:right-8"
                    style={{ background: P.terracotta, zIndex: 50 }}
                >
                    <ShoppingCart className="h-4 w-4" />
                    <span>{cartItemCount} item{cartItemCount > 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{currency}{cartTotal.toFixed(2)}</span>
                </motion.button>
            )}

            {/* ─── Item Detail Sheet (bottom sheet on mobile, centered modal on desktop) ── */}
            <AnimatePresence>
                {selectedItem && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50"
                            style={{ zIndex: 60 }}
                            onClick={() => setSelectedItem(null)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-1/2 w-full -translate-x-1/2 overflow-y-auto rounded-t-3xl pb-8 sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-3xl"
                            style={{ zIndex: 70, maxHeight: '90vh', background: P.creamLight }}
                        >
                            {/* Item image */}
                            <div className="relative h-52 sm:h-60">
                                {selectedItem.image_url ? (
                                    <img src={selectedItem.image_url} alt={selectedItem.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-6xl" style={{ background: P.sand }}>
                                        ☕
                                    </div>
                                )}
                                <button onClick={() => setSelectedItem(null)} className="absolute right-4 top-4 rounded-full p-2" style={{ background: 'rgba(239,232,220,0.9)' }}>
                                    <X className="h-5 w-5" style={{ color: P.espresso }} />
                                </button>
                            </div>

                            <div className="px-5 pt-4 sm:px-7">
                                <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: P.espresso }}>
                                    {selectedItem.name}
                                </h2>
                                <p className="mt-1 text-sm" style={{ color: P.caramel }}>{selectedItem.description}</p>
                                <p className="mt-2 text-lg font-bold" style={{ color: P.terracotta }}>
                                    {selectedItem.has_variations && !selectedVariationId
                                        ? `From ${currency}${(selectedItem.display_price ?? selectedItem.price).toFixed(2)}`
                                        : `${currency}${computeUnitPrice(selectedItem, selectedVariationId, {}).toFixed(2)}`}
                                </p>

                                {selectedItem.variations && selectedItem.variations.length > 0 && (
                                    <div className="mt-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold" style={{ color: P.espresso }}>Size</h3>
                                            <span className="text-xs" style={{ color: P.terracotta }}>* Required</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {selectedItem.variations.map((variation) => {
                                                const isSelected = selectedVariationId === variation.id;
                                                return (
                                                    <button
                                                        key={variation.id}
                                                        onClick={() => setSelectedVariationId(variation.id)}
                                                        className="flex flex-col items-center px-3 py-1.5 text-xs transition-all"
                                                        style={{
                                                            background: isSelected ? P.navy : 'white',
                                                            border: `2px solid ${isSelected ? P.navy : P.sand}`,
                                                            color: isSelected ? 'white' : P.espresso,
                                                            minWidth: '60px',
                                                        }}
                                                    >
                                                        <span className="font-semibold">{variation.name}</span>
                                                        <span className="text-[10px]" style={{ color: isSelected ? P.cream : P.terracotta }}>
                                                            {currency}{variation.price.toFixed(2)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Add-on groups */}
                                {selectedItem.addon_groups.map((group) => (
                                    <div key={group.id} className="mt-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold" style={{ color: P.espresso }}>{group.name}</h3>
                                            {group.is_required && <span className="text-xs" style={{ color: P.terracotta }}>* Required</span>}
                                            {group.max_selections > 1 && (
                                                <span className="text-xs" style={{ color: P.caramel }}>(up to {group.max_selections})</span>
                                            )}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {group.addons.map((addon) => {
                                                const isSelected = selectedAddons[group.id]?.includes(addon.id);
                                                const priceLabel = addon.additional_price > 0
                                                    ? `+${currency}${addon.additional_price}`
                                                    : addon.additional_price < 0
                                                        ? `-${currency}${Math.abs(addon.additional_price)}`
                                                        : 'Free';
                                                return (
                                                    <button
                                                        key={addon.id}
                                                        onClick={() => toggleAddon(group.id, addon.id, group.max_selections)}
                                                        className="flex flex-col items-center px-3 py-1.5 text-xs transition-all"
                                                        style={{
                                                            background: isSelected ? P.navy : 'white',
                                                            border: `2px solid ${isSelected ? P.navy : P.sand}`,
                                                            color: isSelected ? 'white' : P.espresso,
                                                            minWidth: '60px',
                                                        }}
                                                    >
                                                        <span className="font-semibold">{addon.name}</span>
                                                        <span className="text-[10px]" style={{ color: isSelected ? P.cream : addon.additional_price !== 0 ? P.terracotta : P.caramel }}>
                                                            {priceLabel}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {/* Item notes */}
                                <div className="mt-4">
                                    <label className="text-sm font-semibold" style={{ color: P.espresso }}>Special instructions (optional)</label>
                                    <textarea
                                        value={itemNotes}
                                        onChange={(e) => setItemNotes(e.target.value)}
                                        placeholder="E.g., less ice, extra hot..."
                                        className="mt-1 w-full bg-white px-3 py-2 text-sm focus:outline-none"
                                        style={{ border: `2px solid ${P.sand}` }}
                                        rows={2}
                                    />
                                </div>

                                {/* Quantity + Add to Cart */}
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="flex items-center gap-2 bg-white px-2" style={{ border: `2px solid ${P.sand}` }}>
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1.5">
                                            <Minus className="h-4 w-4" style={{ color: P.espresso }} />
                                        </button>
                                        <span className="w-6 text-center font-bold" style={{ color: P.espresso }}>{quantity}</span>
                                        <button onClick={() => setQuantity(quantity + 1)} className="p-1.5">
                                            <Plus className="h-4 w-4" style={{ color: P.espresso }} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={addToCart}
                                        disabled={!canAddToCart()}
                                        className="flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-all"
                                        style={{
                                            background: canAddToCart() ? P.navy : P.sand,
                                            color: canAddToCart() ? 'white' : P.caramel,
                                        }}
                                    >
                                        Add to Cart — {currency}{(computeUnitPrice(selectedItem, selectedVariationId, selectedAddons) * quantity).toFixed(2)}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ─── Cart Drawer ─────────────────────────────────────── */}
            <AnimatePresence>
                {cartOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50"
                            style={{ zIndex: 60 }}
                            onClick={() => setCartOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-y-0 right-0 flex w-full flex-col sm:max-w-md"
                            style={{ zIndex: 70, background: P.creamLight }}
                        >
                            <div className="flex items-center justify-between px-5 py-4" style={{ background: P.navy }}>
                                <h2 className="text-lg font-black uppercase tracking-tight text-white">Your Order</h2>
                                <button onClick={() => setCartOpen(false)}>
                                    <X className="h-5 w-5 text-white" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 py-4">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20" style={{ color: P.caramel }}>
                                        <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
                                        <p>Your cart is empty</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {cart.map((item) => (
                                            <div key={item.id} className="bg-white p-3" style={{ border: `2px solid ${P.sand}` }}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold" style={{ color: P.espresso }}>{item.menuItem.name}</p>
                                                        {(item.selectedVariation || item.selectedAddons.length > 0) && (
                                                            <p className="mt-0.5 text-xs" style={{ color: P.caramel }}>
                                                                {[item.selectedVariation?.name, ...item.selectedAddons.map((a) => a.name)].filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                        {item.notes && <p className="mt-0.5 text-xs italic" style={{ color: P.caramel }}>"{item.notes}"</p>}
                                                    </div>
                                                    <button onClick={() => removeFromCart(item.id)}>
                                                        <X className="h-4 w-4" style={{ color: P.caramel }} />
                                                    </button>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 px-2" style={{ border: `2px solid ${P.sand}` }}>
                                                        <button onClick={() => updateCartItemQuantity(item.id, -1)} className="p-1">
                                                            <Minus className="h-3 w-3" style={{ color: P.espresso }} />
                                                        </button>
                                                        <span className="w-4 text-center text-sm font-bold" style={{ color: P.espresso }}>{item.quantity}</span>
                                                        <button onClick={() => updateCartItemQuantity(item.id, 1)} className="p-1">
                                                            <Plus className="h-3 w-3" style={{ color: P.espresso }} />
                                                        </button>
                                                    </div>
                                                    <span className="text-sm font-bold" style={{ color: P.terracotta }}>
                                                        {currency}{item.subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {cart.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    {table ? (
                                        <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white" style={{ background: P.navy }}>
                                            🍽️ Dine-in · {table.name}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Fulfillment: pickup or delivery */}
                                            <div>
                                                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: P.espresso }}>How do you want it?</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {([
                                                        { value: 'pickup', label: '🏪 Pickup', hint: 'At the counter' },
                                                        { value: 'delivery', label: '🛵 Delivery', hint: settings.delivery_fee > 0 ? `+${settings.currency}${settings.delivery_fee.toFixed(2)} fee` : 'To your address' },
                                                    ] as const).map((option) => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => setFulfillment(option.value)}
                                                            className="flex flex-col items-center py-2 text-sm font-bold transition-all"
                                                            style={{
                                                                background: fulfillment === option.value ? P.navy : 'white',
                                                                border: `2px solid ${fulfillment === option.value ? P.navy : P.sand}`,
                                                                color: fulfillment === option.value ? 'white' : P.espresso,
                                                            }}
                                                        >
                                                            <span>{option.label}</span>
                                                            <span className="text-[10px] font-normal" style={{ color: fulfillment === option.value ? P.cream : P.caramel }}>{option.hint}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Free delivery progress */}
                                            {fulfillment === 'delivery' && settings.free_delivery_minimum > 0 && settings.delivery_fee > 0 && (
                                                qualifiesFreeDelivery ? (
                                                    <div className="px-3 py-2 text-xs font-bold text-white" style={{ background: '#5B8A4E' }}>
                                                        🎉 You qualify for FREE delivery!
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2 text-xs font-bold" style={{ background: '#FDEBD3', border: `2px solid ${P.caramel}`, color: '#8A5A18' }}>
                                                        🛵 Add {currency}{amountToFreeDelivery.toFixed(2)} more to get FREE delivery (min. {currency}{settings.free_delivery_minimum.toFixed(2)})
                                                    </div>
                                                )
                                            )}

                                            {/* Delivery location */}
                                            {fulfillment === 'delivery' && (
                                                <div className="space-y-2">
                                                    <textarea
                                                        value={deliveryAddress}
                                                        onChange={(e) => setDeliveryAddress(e.target.value)}
                                                        placeholder="Delivery address (house no., street, barangay, city, landmark...)"
                                                        className="w-full bg-white px-3 py-2 text-sm focus:outline-none"
                                                        style={{ border: `2px solid ${P.sand}` }}
                                                        rows={2}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={useCurrentLocation}
                                                        disabled={isLocating}
                                                        className="w-full py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
                                                        style={{ background: P.caramel }}
                                                    >
                                                        {isLocating ? 'Locating...' : deliveryCoords ? '📍 Location pinned — tap to re-pin' : '📍 Pin my current location'}
                                                    </button>
                                                    {deliveryCoords && (
                                                        <div style={{ border: `2px solid ${P.sand}` }}>
                                                            <iframe
                                                                title="Pinned delivery location"
                                                                className="h-36 w-full"
                                                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${deliveryCoords.lng - 0.003},${deliveryCoords.lat - 0.002},${deliveryCoords.lng + 0.003},${deliveryCoords.lat + 0.002}&layer=mapnik&marker=${deliveryCoords.lat},${deliveryCoords.lng}`}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Payment method */}
                                            <div>
                                                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: P.espresso }}>Payment method</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {([
                                                        { value: 'cod', label: '💵 COD' },
                                                        { value: 'gcash', label: 'GCash' },
                                                        { value: 'maya', label: 'Maya' },
                                                    ] as const).map((option) => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => { setPaymentMethod(option.value); if (option.value === 'cod') setPaymentProof(null); }}
                                                            className="py-2 text-sm font-bold transition-all"
                                                            style={{
                                                                background: paymentMethod === option.value ? P.navy : 'white',
                                                                border: `2px solid ${paymentMethod === option.value ? P.navy : P.sand}`,
                                                                color: paymentMethod === option.value ? 'white' : P.espresso,
                                                            }}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Proof of payment upload for e-wallets */}
                                                {(paymentMethod === 'gcash' || paymentMethod === 'maya') && (
                                                    <div className="mt-2">
                                                        {(() => {
                                                            const walletName = paymentMethod === 'gcash' ? 'GCash' : 'Maya';
                                                            const walletNumber = paymentMethod === 'gcash' ? settings.gcash_number : settings.maya_number;
                                                            const walletAccount = paymentMethod === 'gcash' ? settings.gcash_account_name : settings.maya_account_name;
                                                            const walletQr = paymentMethod === 'gcash' ? settings.gcash_qr_url : settings.maya_qr_url;
                                                            return (
                                                                <div className="mb-2 bg-white p-3" style={{ border: `2px solid ${P.sand}` }}>
                                                                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P.espresso }}>
                                                                        How to pay with {walletName}
                                                                    </p>
                                                                    <div className="mt-2 flex items-start gap-3">
                                                                        {walletQr && (
                                                                            <img
                                                                                src={walletQr}
                                                                                alt={`${walletName} QR code`}
                                                                                className="h-28 w-28 shrink-0 object-contain"
                                                                                style={{ border: `2px solid ${P.sand}` }}
                                                                            />
                                                                        )}
                                                                        <ol className="list-inside list-decimal space-y-1 text-[11px]" style={{ color: P.espresso }}>
                                                                            <li>{walletQr ? `Scan the QR code with your ${walletName} app` : `Open your ${walletName} app`}{walletNumber ? `, or send to ${walletNumber}` : ''}{walletAccount ? ` (${walletAccount})` : ''}.</li>
                                                                            <li>Send exactly <strong>{currency}{cartTotal.toFixed(2)}</strong>.</li>
                                                                            <li>Screenshot the receipt and upload it below.</li>
                                                                        </ol>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                        <label
                                                            className="flex cursor-pointer items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-wide"
                                                            style={{
                                                                background: paymentProof ? P.navy : 'white',
                                                                border: `2px dashed ${paymentProof ? P.navy : P.caramel}`,
                                                                color: paymentProof ? 'white' : P.caramel,
                                                            }}
                                                        >
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => setPaymentProof(e.target.files?.[0] ?? null)}
                                                            />
                                                            {paymentProof ? `✓ ${paymentProof.name}` : '📷 Upload proof of payment'}
                                                        </label>

                                                        {/* Preview of the uploaded proof */}
                                                        {proofPreviewUrl && (
                                                            <div className="mt-2 bg-white p-2" style={{ border: `2px solid ${P.navy}` }}>
                                                                <div className="mb-1.5 flex items-center justify-between">
                                                                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: P.espresso }}>
                                                                        Your proof of payment
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPaymentProof(null)}
                                                                        className="text-[10px] font-bold uppercase"
                                                                        style={{ color: P.terracotta }}
                                                                    >
                                                                        ✕ Remove
                                                                    </button>
                                                                </div>
                                                                <img
                                                                    src={proofPreviewUrl}
                                                                    alt="Proof of payment preview"
                                                                    className="max-h-56 w-full object-contain"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    <textarea
                                        value={orderNotes}
                                        onChange={(e) => setOrderNotes(e.target.value)}
                                        placeholder="Any special requests for the whole order?"
                                        className="w-full bg-white px-3 py-2 text-sm focus:outline-none"
                                        style={{ border: `2px solid ${P.sand}` }}
                                        rows={2}
                                    />

                                    {/* Cup progress + free drink redemption */}
                                    {settings.loyalty_cups_enabled && customer && (
                                        <div className="bg-white p-3" style={{ border: `2px solid ${P.sand}` }}>
                                            {freeDrinksAvailable > 0 ? (
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-bold" style={{ color: P.espresso }}>
                                                            🎁 Redeem free drink
                                                        </p>
                                                        <p className="text-[10px]" style={{ color: P.caramel }}>
                                                            {freeDrinksAvailable} available · saves {currency}{cheapestItemPrice.toFixed(2)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setUseFreeDrink(!useFreeDrink)}
                                                        className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
                                                        style={{ background: useFreeDrink ? P.terracotta : P.sand }}
                                                    >
                                                        <span className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: useFreeDrink ? 'translateX(16px)' : 'translateX(0)' }} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="mb-1.5 flex items-center justify-between">
                                                        <p className="text-xs font-bold" style={{ color: P.espresso }}>
                                                            ☕ Cup progress
                                                        </p>
                                                        <p className="text-[10px]" style={{ color: P.caramel }}>
                                                            {cupCount}/{settings.loyalty_cups_threshold} — {settings.loyalty_cups_threshold - cupCount} more to go
                                                        </p>
                                                    </div>
                                                    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: P.sand }}>
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            style={{ background: P.terracotta }}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min((cupCount / settings.loyalty_cups_threshold) * 100, 100)}%` }}
                                                            transition={{ duration: 0.6, ease: 'easeOut' }}
                                                        />
                                                    </div>
                                                    <div className="mt-1.5 flex gap-1">
                                                        {Array.from({ length: settings.loyalty_cups_threshold }).map((_, i) => (
                                                            <span key={i} className="text-[10px]" style={{ opacity: i < cupCount ? 1 : 0.25 }}>☕</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Promo code input */}
                                    <div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: P.caramel }} />
                                                <input
                                                    value={promoCode}
                                                    onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); if (promoApplied) setPromoApplied(null); }}
                                                    placeholder="Promo code"
                                                    className="w-full bg-white py-2 pl-8 pr-3 font-mono text-sm focus:outline-none"
                                                    style={{ border: `2px solid ${P.sand}` }}
                                                />
                                            </div>
                                            <button
                                                onClick={applyPromo}
                                                disabled={isApplyingPromo || !promoCode.trim()}
                                                className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-40"
                                                style={{ background: P.navy }}
                                            >
                                                {isApplyingPromo ? '...' : 'Apply'}
                                            </button>
                                        </div>
                                        {promoApplied && (
                                            <p className="mt-1 text-xs font-medium" style={{ color: '#059669' }}>
                                                ✓ {promoApplied.code} — {currency}{promoApplied.discount.toFixed(2)} off
                                            </p>
                                        )}
                                    </div>

                                    {/* Points redemption toggle */}
                                    {customer && customer.points >= redeemRate && (
                                        <div className="flex items-center justify-between bg-white px-3 py-2.5" style={{ border: `2px solid ${P.sand}` }}>
                                            <div>
                                                <p className="text-xs font-bold" style={{ color: P.espresso }}>
                                                    ⭐ Use {customer.points} points
                                                </p>
                                                <p className="text-[10px]" style={{ color: P.caramel }}>
                                                    = {currency}{(customer.points / redeemRate).toFixed(2)} off
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setRedeemPoints(!redeemPoints)}
                                                className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
                                                style={{ background: redeemPoints ? P.terracotta : P.sand }}
                                            >
                                                <span className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: redeemPoints ? 'translateX(16px)' : 'translateX(0)' }} />
                                            </button>
                                        </div>
                                    )}

                                </div>
                                )}
                            </div>

                            {cart.length > 0 && (
                                <div className="space-y-3 px-4 py-4" style={{ borderTop: `2px solid ${P.sand}` }}>
                                    {/* Order summary */}
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <span style={{ color: P.caramel }}>Subtotal</span>
                                            <span className="font-bold" style={{ color: P.espresso }}>{currency}{cartSubtotal.toFixed(2)}</span>
                                        </div>
                                        {promoDiscount > 0 && (
                                            <div className="flex justify-between" style={{ color: '#059669' }}>
                                                <span className="text-xs">Promo ({promoApplied!.code})</span>
                                                <span className="text-xs font-semibold">-{currency}{promoDiscount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {pointsDiscount > 0 && (
                                            <div className="flex justify-between" style={{ color: '#D97706' }}>
                                                <span className="text-xs">Points redeemed</span>
                                                <span className="text-xs font-semibold">-{currency}{pointsDiscount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {freeDrinkDiscount > 0 && (
                                            <div className="flex justify-between" style={{ color: '#059669' }}>
                                                <span className="text-xs">🎁 Free drink</span>
                                                <span className="text-xs font-semibold">-{currency}{freeDrinkDiscount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {deliveryFeeApplies && (
                                            <div className="flex justify-between">
                                                <span className="text-xs" style={{ color: P.caramel }}>🛵 Delivery fee</span>
                                                {qualifiesFreeDelivery ? (
                                                    <span className="text-xs font-bold" style={{ color: '#059669' }}>FREE</span>
                                                ) : (
                                                    <span className="text-xs font-semibold" style={{ color: P.espresso }}>{currency}{deliveryFee.toFixed(2)}</span>
                                                )}
                                            </div>
                                        )}
                                        {(promoDiscount > 0 || pointsDiscount > 0 || freeDrinkDiscount > 0 || deliveryFee > 0) && (
                                            <div className="flex justify-between pt-1.5" style={{ borderTop: `2px solid ${P.sand}` }}>
                                                <span className="font-bold" style={{ color: P.espresso }}>Total</span>
                                                <span className="font-bold" style={{ color: P.terracotta }}>{currency}{cartTotal.toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Points earn preview */}
                                    {customer && earnRate > 0 && (
                                        <p className="text-center text-[10px]" style={{ color: P.caramel }}>
                                            ⭐ You'll earn ~{Math.floor(cartTotal * earnRate)} points on this order
                                        </p>
                                    )}

                                    <button
                                        onClick={placeOrder}
                                        disabled={isPlacingOrder}
                                        className="w-full py-3.5 text-center text-sm font-bold uppercase tracking-widest text-white transition-all"
                                        style={{ background: P.terracotta }}
                                    >
                                        {isPlacingOrder ? 'Placing Order...' : `Place Order — ${currency}${cartTotal.toFixed(2)}`}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ─── Sign-in prompt ──────────────────────────────────── */}
            <AnimatePresence>
                {authPromptOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50"
                            style={{ zIndex: 80 }}
                            onClick={() => setAuthPromptOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed bottom-0 left-1/2 w-full -translate-x-1/2 rounded-t-3xl px-6 pb-8 pt-6 text-center sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-3xl"
                            style={{ zIndex: 90, background: P.creamLight }}
                        >
                            <div className="text-4xl">☕</div>
                            <h2 className="mt-2 text-lg font-black uppercase tracking-tight" style={{ color: P.espresso }}>
                                Almost there!
                            </h2>
                            <p className="mt-1 text-sm" style={{ color: P.caramel }}>
                                Sign in or create a free account to place your order — and earn loyalty points on every purchase.
                            </p>
                            <div className="mt-5 space-y-2">
                                <button
                                    onClick={() => router.visit(customerAuthLogin(table?.qr_token))}
                                    className="w-full py-3 text-sm font-bold uppercase tracking-widest text-white"
                                    style={{ background: P.navy }}
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => router.visit(customerAuthRegister(table?.qr_token))}
                                    className="w-full py-3 text-sm font-bold uppercase tracking-widest"
                                    style={{ border: `2px solid ${P.navy}`, color: P.navy, background: 'transparent' }}
                                >
                                    Create Account
                                </button>
                                <button
                                    onClick={() => setAuthPromptOpen(false)}
                                    className="w-full py-2 text-xs font-medium"
                                    style={{ color: P.caramel }}
                                >
                                    Keep browsing
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <CustomerNav current="menu" />
        </div>
    );
}

function CafeLogo({ name }: { name: string }) {
    return (
        <div className="flex shrink-0 items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 17.314 10.686 20 14 20C17.314 20 20 17.314 20 14C20 8 14 2 14 2Z" fill="#C05B2D" />
                <path d="M14 20V26M11 26H17" stroke="#C05B2D" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 26C10 26 12 24 14 26C16 28 18 26 18 26" stroke="#E4DACB" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span className="hidden text-lg font-black uppercase tracking-tight text-white sm:inline">
                {name}
            </span>
        </div>
    );
}

/* Retro geometric decoration inspired by the reference design:
   semicircles, arcs and circles in navy / terracotta / caramel */
function GeometricShapes() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {/* Left cluster */}
            <div className="absolute -left-10 top-6 h-32 w-32 rounded-full" style={{ background: P.terracotta, opacity: 0.9 }} />
            <div className="absolute left-8 top-28 h-24 w-24 rounded-full" style={{ background: P.navy }} />
            <div className="absolute -left-6 bottom-4 h-40 w-40" style={{ background: P.caramel, borderRadius: '0 100% 0 0' }} />
            {/* Rainbow arcs (nested half rings) */}
            <div className="absolute left-16 bottom-16 h-20 w-40 overflow-hidden">
                <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full border-[10px]" style={{ borderColor: P.terracotta }} />
                <div className="absolute bottom-[-10px] left-[10px] h-[120px] w-[120px] rounded-full border-[10px]" style={{ borderColor: P.caramel }} />
                <div className="absolute bottom-[-20px] left-[20px] h-[80px] w-[80px] rounded-full border-[10px]" style={{ borderColor: P.navy }} />
            </div>
            {/* Top semicircle */}
            <div className="absolute left-1/3 -top-12 h-24 w-24 rounded-full" style={{ background: P.espresso, opacity: 0.15 }} />
            {/* Right cluster */}
            <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full" style={{ background: P.caramel, opacity: 0.55 }} />
            <div className="absolute right-10 bottom-0 h-32 w-32" style={{ background: P.terracotta, opacity: 0.7, borderRadius: '100% 0 0 0' }} />
            <div className="absolute right-40 bottom-10 hidden h-16 w-16 rounded-full md:block" style={{ background: P.navy, opacity: 0.85 }} />
        </div>
    );
}

function CoffeeCupIllustration() {
    return (
        <svg width="200" height="240" viewBox="0 0 200 240" fill="none" aria-hidden="true">
            {/* Cup body */}
            <path d="M45 70 L60 220 C60 228 70 234 100 234 C130 234 140 228 140 220 L155 70 Z" fill="#F3EEE6" stroke="#D8CBB8" strokeWidth="2" />
            {/* Sleeve */}
            <path d="M50 115 L150 115 L146 160 L54 160 Z" fill="#6B4423" />
            <circle cx="100" cy="137" r="16" fill="#F3EEE6" />
            <path d="M100 127 C100 127 96 131 96 135 C96 137.5 97.8 139 100 139 C102.2 139 104 137.5 104 135 C104 131 100 127 100 127Z" fill="#6B4423" />
            {/* Lid */}
            <ellipse cx="100" cy="62" rx="62" ry="14" fill="#33302E" />
            <rect x="38" y="48" width="124" height="16" rx="8" fill="#33302E" />
            <rect x="62" y="34" width="76" height="18" rx="9" fill="#3E3B38" />
        </svg>
    );
}

function SectionHeading({ label }: { label: string }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-black uppercase tracking-tight sm:text-xl" style={{ color: P.espresso }}>
                {label}
            </h2>
            <div className="h-[3px] flex-1 max-w-24" style={{ background: P.terracotta }} />
        </div>
    );
}

function FeaturedCard({ item, currency, onSelect }: { item: MenuItem; currency: string; onSelect: (item: MenuItem) => void }) {
    return (
        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(item)}
            className="w-44 shrink-0 overflow-hidden text-left shadow-sm transition-shadow hover:shadow-md md:w-auto"
            style={{ background: P.creamLight, border: `2px solid ${P.navy}` }}
        >
            <div className="h-28 overflow-hidden">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-4xl" style={{ background: P.sand }}>☕</div>
                )}
            </div>
            <div className="p-3">
                <p className="text-sm font-bold leading-tight" style={{ color: P.espresso }}>{item.name}</p>
                <p className="mt-1 text-sm font-bold" style={{ color: P.terracotta }}>
                    {item.has_variations ? `From ${currency}${(item.display_price ?? item.price).toFixed(2)}` : `${currency}${item.price.toFixed(2)}`}
                </p>
            </div>
        </motion.button>
    );
}

function MenuCard({ item, currency, onSelect }: { item: MenuItem; currency: string; onSelect: (item: MenuItem) => void }) {
    return (
        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(item)}
            className="overflow-hidden text-left shadow-sm transition-shadow hover:shadow-md"
            style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}
        >
            <div className="h-32 overflow-hidden sm:h-36">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-4xl" style={{ background: P.sand }}>☕</div>
                )}
            </div>
            <div className="p-3">
                <p className="text-sm font-bold leading-tight" style={{ color: P.espresso }}>{item.name}</p>
                {item.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-tight" style={{ color: P.caramel }}>{item.description}</p>
                )}
                <p className="mt-2 text-sm font-bold" style={{ color: P.terracotta }}>
                    {item.has_variations ? `From ${currency}${(item.display_price ?? item.price).toFixed(2)}` : `${currency}${item.price.toFixed(2)}`}
                </p>
            </div>
        </motion.button>
    );
}
