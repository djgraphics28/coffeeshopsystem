import { Head, router } from '@inertiajs/react';
import { storefrontOrdersShow, storefrontOrdersStore } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

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

interface Props {
    table: { id: number; name: string; qr_token: string };
    categories: Category[];
    featured_items: MenuItem[];
    settings: {
        cafe_name: string;
        cafe_tagline: string;
        currency: string;
        estimated_wait_minutes: string;
    };
}

export default function Storefront({ table, categories, featured_items, settings }: Props) {
    const [activeCategory, setActiveCategory] = useState<number | null>(categories[0]?.id ?? null);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartOpen, setCartOpen] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);
    const [selectedAddons, setSelectedAddons] = useState<Record<number, number[]>>({});
    const [itemNotes, setItemNotes] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const categoryRefs = useRef<Record<number, HTMLElement | null>>({});
    const stickyHeaderRef = useRef<HTMLDivElement>(null);

    const currency = settings.currency;

    const allItems = categories.flatMap((c) => c.menu_items);
    const filteredItems = searchQuery
        ? allItems.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : null;

    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

    function scrollToCategory(categoryId: number) {
        setActiveCategory(categoryId);
        const el = categoryRefs.current[categoryId];
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

    async function placeOrder() {
        if (cart.length === 0) return;
        setIsPlacingOrder(true);

        try {
            const response = await fetch(storefrontOrdersStore(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' },
                body: JSON.stringify({
                    table_id: table.id,
                    type: 'dine-in',
                    notes: orderNotes,
                    items: cart.map((item) => ({
                        menu_item_id: item.menuItem.id,
                        variation_id: item.selectedVariation?.id ?? null,
                        quantity: item.quantity,
                        notes: item.notes,
                        addon_ids: item.selectedAddons.map((a) => a.id),
                    })),
                }),
            });

            if (!response.ok) throw new Error('Order failed');
            const data = await response.json();
            setCart([]);
            setCartOpen(false);
            router.visit(storefrontOrdersShow(data.order.id));
        } catch {
            toast.error('Failed to place order. Please try again.');
        } finally {
            setIsPlacingOrder(false);
        }
    }

    const displayItems = filteredItems ?? (activeCategory ? categories.find((c) => c.id === activeCategory)?.menu_items ?? [] : []);

    return (
        <div className="min-h-screen" style={{ background: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", maxWidth: '430px', margin: '0 auto' }}>
            <Head title={`${settings.cafe_name} — Order`} />
            <Toaster position="top-center" />

            {/* Hero Header */}
            <div className="relative h-56 overflow-hidden">
                {/* Background: photo with CSS gradient fallback */}
                <img
                    src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                {/* Always-visible dark overlay — ensures content is readable even if image fails */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #2C1A0E 0%, #4a2e18 50%, #2C1A0E 100%)' }} />
                {/* Decorative coffee-ring pattern */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle at 20% 50%, #D4A843 1px, transparent 1px), radial-gradient(circle at 80% 20%, #D4A843 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }} />
                <div className="relative flex h-full flex-col items-center justify-center text-white">
                    <CafeLogo />
                    <p className="mt-1 text-sm opacity-80" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {settings.cafe_tagline}
                    </p>
                </div>
                {/* Table badge */}
                <div className="absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: 'rgba(212,168,67,0.9)' }}>
                    {table.name}
                </div>
            </div>

            {/* Sticky Search + Category Tabs */}
            <div ref={stickyHeaderRef} className="sticky top-0 z-30" style={{ background: '#2C1A0E' }}>
                {/* Search Bar */}
                <div className="px-4 pt-3 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search menu..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full bg-white/10 py-2 pl-9 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2"
                            style={{ '--tw-ring-color': '#D4A843' } as React.CSSProperties}
                        />
                    </div>
                </div>

                {/* Category Tabs */}
                {!searchQuery && (
                    <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: 'none' }}>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => scrollToCategory(cat.id)}
                                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all"
                                style={{
                                    background: activeCategory === cat.id ? '#D4A843' : 'rgba(255,255,255,0.1)',
                                    color: activeCategory === cat.id ? '#2C1A0E' : 'white',
                                }}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="pb-32">
                {/* Featured Carousel */}
                {!searchQuery && featured_items.length > 0 && (
                    <div className="px-4 pb-4">
                        <h2 className="mb-3 text-base font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                            ✨ Staff Picks
                        </h2>
                        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                            {featured_items.map((item) => (
                                <FeaturedCard key={item.id} item={item} currency={currency} onSelect={openItem} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Search Results */}
                {searchQuery && (
                    <div className="px-4">
                        <p className="mb-3 text-sm text-gray-500">{filteredItems?.length ?? 0} results for "{searchQuery}"</p>
                        <div className="grid grid-cols-2 gap-3">
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
                            className="px-4 pb-6"
                        >
                            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                                <span>{cat.icon}</span>
                                {cat.name}
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                {cat.menu_items.map((item) => (
                                    <MenuCard key={item.id} item={item} currency={currency} onSelect={openItem} />
                                ))}
                            </div>
                        </div>
                    ))}

                {/* While You Wait section */}
                {!searchQuery && (
                    <div className="mx-4 mb-6 rounded-2xl p-4" style={{ background: '#2C1A0E', color: 'white' }}>
                        <h2 className="mb-2 text-sm font-semibold" style={{ color: '#D4A843', fontFamily: "'Playfair Display', serif" }}>
                            While you wait...
                        </h2>
                        <p className="mb-3 text-xs text-gray-300">Watch our baristas craft your drink with love ☕</p>
                        <div className="space-y-2">
                            <iframe
                                className="w-full rounded-xl"
                                height="160"
                                src="https://www.youtube.com/embed/5WCB5BbdxFI"
                                title="Coffee crafting"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Cart Button */}
            {cartItemCount > 0 && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setCartOpen(true)}
                    className="fixed bottom-6 right-4 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
                    style={{ background: '#D4A843', zIndex: 50, color: '#2C1A0E' }}
                >
                    <ShoppingCart className="h-4 w-4" />
                    <span>{cartItemCount} item{cartItemCount > 1 ? 's' : ''}</span>
                    <span className="font-bold">
                        {currency}{cartTotal.toFixed(2)}
                    </span>
                </motion.button>
            )}

            {/* Item Detail Bottom Sheet */}
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
                            className="fixed bottom-0 left-1/2 w-full -translate-x-1/2 overflow-y-auto rounded-t-3xl bg-white pb-8"
                            style={{ zIndex: 70, maxWidth: '430px', maxHeight: '90vh' }}
                        >
                            {/* Item image */}
                            <div className="relative h-52">
                                {selectedItem.image_url ? (
                                    <img src={selectedItem.image_url} alt={selectedItem.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-6xl" style={{ background: '#FDF6EC' }}>
                                        ☕
                                    </div>
                                )}
                                <button onClick={() => setSelectedItem(null)} className="absolute right-4 top-4 rounded-full bg-white/80 p-2">
                                    <X className="h-5 w-5" style={{ color: '#2C1A0E' }} />
                                </button>
                            </div>

                            <div className="px-5 pt-4">
                                <h2 className="text-xl font-bold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                                    {selectedItem.name}
                                </h2>
                                <p className="mt-1 text-sm text-gray-500">{selectedItem.description}</p>
                                <p className="mt-2 text-lg font-bold" style={{ color: '#D4A843' }}>
                                    {selectedItem.has_variations && !selectedVariationId
                                        ? `From ${currency}${(selectedItem.display_price ?? selectedItem.price).toFixed(2)}`
                                        : `${currency}${computeUnitPrice(selectedItem, selectedVariationId, {}).toFixed(2)}`}
                                </p>

                                {selectedItem.variations && selectedItem.variations.length > 0 && (
                                    <div className="mt-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold" style={{ color: '#2C1A0E' }}>Size</h3>
                                            <span className="text-xs text-red-500">* Required</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {selectedItem.variations.map((variation) => {
                                                const isSelected = selectedVariationId === variation.id;
                                                return (
                                                    <button
                                                        key={variation.id}
                                                        onClick={() => setSelectedVariationId(variation.id)}
                                                        className="flex flex-col items-center rounded-xl px-3 py-1.5 text-xs transition-all"
                                                        style={{
                                                            background: isSelected ? '#FDF6EC' : '#F9F9F9',
                                                            border: `2px solid ${isSelected ? '#D4A843' : '#E5E5E5'}`,
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

                                {/* Add-on groups */}
                                {selectedItem.addon_groups.map((group) => (
                                    <div key={group.id} className="mt-4">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold" style={{ color: '#2C1A0E' }}>{group.name}</h3>
                                            {group.is_required && <span className="text-xs text-red-500">* Required</span>}
                                            {group.max_selections > 1 && (
                                                <span className="text-xs text-gray-400">(up to {group.max_selections})</span>
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
                                                        className="flex flex-col items-center rounded-xl px-3 py-1.5 text-xs transition-all"
                                                        style={{
                                                            background: isSelected ? '#FDF6EC' : '#F9F9F9',
                                                            border: `2px solid ${isSelected ? '#D4A843' : '#E5E5E5'}`,
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

                                {/* Item notes */}
                                <div className="mt-4">
                                    <label className="text-sm font-medium" style={{ color: '#2C1A0E' }}>Special instructions (optional)</label>
                                    <textarea
                                        value={itemNotes}
                                        onChange={(e) => setItemNotes(e.target.value)}
                                        placeholder="E.g., less ice, extra hot..."
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                        rows={2}
                                    />
                                </div>

                                {/* Quantity + Add to Cart */}
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="flex items-center gap-2 rounded-full border border-gray-200 px-2">
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1.5">
                                            <Minus className="h-4 w-4" style={{ color: '#2C1A0E' }} />
                                        </button>
                                        <span className="w-6 text-center font-semibold" style={{ color: '#2C1A0E' }}>{quantity}</span>
                                        <button onClick={() => setQuantity(quantity + 1)} className="p-1.5">
                                            <Plus className="h-4 w-4" style={{ color: '#2C1A0E' }} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={addToCart}
                                        disabled={!canAddToCart()}
                                        className="flex-1 rounded-full py-3 text-sm font-semibold transition-all"
                                        style={{
                                            background: canAddToCart() ? '#D4A843' : '#E5E5E5',
                                            color: canAddToCart() ? '#2C1A0E' : '#9CA3AF',
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

            {/* Cart Drawer */}
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
                            className="fixed inset-y-0 right-0 flex w-full flex-col bg-white"
                            style={{ zIndex: 70, maxWidth: '430px' }}
                        >
                            <div className="flex items-center justify-between px-5 py-4" style={{ background: '#2C1A0E' }}>
                                <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Your Order</h2>
                                <button onClick={() => setCartOpen(false)}>
                                    <X className="h-5 w-5 text-white" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-4 py-4">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                        <ShoppingCart className="mb-3 h-12 w-12 opacity-30" />
                                        <p>Your cart is empty</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {cart.map((item) => (
                                            <div key={item.id} className="rounded-xl bg-gray-50 p-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-sm" style={{ color: '#2C1A0E' }}>{item.menuItem.name}</p>
                                                        {(item.selectedVariation || item.selectedAddons.length > 0) && (
                                                            <p className="mt-0.5 text-xs text-gray-500">
                                                                {[item.selectedVariation?.name, ...item.selectedAddons.map((a) => a.name)].filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                        {item.notes && <p className="mt-0.5 text-xs italic text-gray-400">"{item.notes}"</p>}
                                                    </div>
                                                    <button onClick={() => removeFromCart(item.id)}>
                                                        <X className="h-4 w-4 text-gray-400" />
                                                    </button>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 rounded-full border border-gray-200 px-2">
                                                        <button onClick={() => updateCartItemQuantity(item.id, -1)} className="p-1">
                                                            <Minus className="h-3 w-3" style={{ color: '#2C1A0E' }} />
                                                        </button>
                                                        <span className="w-4 text-center text-sm font-semibold" style={{ color: '#2C1A0E' }}>{item.quantity}</span>
                                                        <button onClick={() => updateCartItemQuantity(item.id, 1)} className="p-1">
                                                            <Plus className="h-3 w-3" style={{ color: '#2C1A0E' }} />
                                                        </button>
                                                    </div>
                                                    <span className="font-bold text-sm" style={{ color: '#D4A843' }}>
                                                        {currency}{item.subtotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {cart.length > 0 && (
                                <div className="border-t border-gray-100 px-4 py-4">
                                    <textarea
                                        value={orderNotes}
                                        onChange={(e) => setOrderNotes(e.target.value)}
                                        placeholder="Any special requests for the whole order?"
                                        className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                        rows={2}
                                    />
                                    <div className="mb-3 flex justify-between text-sm">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span className="font-semibold" style={{ color: '#2C1A0E' }}>{currency}{cartTotal.toFixed(2)}</span>
                                    </div>
                                    <button
                                        onClick={placeOrder}
                                        disabled={isPlacingOrder}
                                        className="w-full rounded-full py-3.5 text-center text-sm font-bold transition-all"
                                        style={{ background: '#D4A843', color: '#2C1A0E' }}
                                    >
                                        {isPlacingOrder ? 'Placing Order...' : `Place Order — ${currency}${cartTotal.toFixed(2)}`}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

function CafeLogo() {
    return (
        <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 17.314 10.686 20 14 20C17.314 20 20 17.314 20 14C20 8 14 2 14 2Z" fill="#D4A843" />
                <path d="M14 20V26M11 26H17" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 26C10 26 12 24 14 26C16 28 18 26 18 26" stroke="#FAF3E0" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, color: '#FAF3E0' }}>
                Milk&Honey
            </span>
        </div>
    );
}

function FeaturedCard({ item, currency, onSelect }: { item: MenuItem; currency: string; onSelect: (item: MenuItem) => void }) {
    return (
        <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(item)}
            className="shrink-0 w-44 overflow-hidden rounded-2xl text-left shadow-sm"
            style={{ background: 'white' }}
        >
            <div className="h-28 overflow-hidden">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-4xl" style={{ background: '#FDF6EC' }}>☕</div>
                )}
            </div>
            <div className="p-3">
                <p className="text-sm font-semibold leading-tight" style={{ color: '#2C1A0E' }}>{item.name}</p>
                <p className="mt-1 text-sm font-bold" style={{ color: '#D4A843' }}>
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
            className="overflow-hidden rounded-2xl text-left shadow-sm"
            style={{ background: 'white' }}
        >
            <div className="h-32 overflow-hidden">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full items-center justify-center text-4xl" style={{ background: '#FDF6EC' }}>☕</div>
                )}
            </div>
            <div className="p-3">
                <p className="text-sm font-semibold leading-tight" style={{ color: '#2C1A0E' }}>{item.name}</p>
                {item.description && (
                    <p className="mt-0.5 text-xs text-gray-400 leading-tight line-clamp-2">{item.description}</p>
                )}
                <p className="mt-2 text-sm font-bold" style={{ color: '#D4A843' }}>
                    {item.has_variations ? `From ${currency}${(item.display_price ?? item.price).toFixed(2)}` : `${currency}${item.price.toFixed(2)}`}
                </p>
            </div>
        </motion.button>
    );
}
