import { Head, router, useForm } from '@inertiajs/react';
import {
    adminMenuItemsBulkPriceUpdate,
    adminMenuItemsDestroy,
    adminMenuItemsIndex,
    adminMenuItemsStore,
    adminMenuItemsToggleAvailability,
    adminMenuItemsUpdate,
} from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckSquare,
    ChevronDown,
    Coffee,
    Edit2,
    ImagePlus,
    Package,
    Percent,
    Plus,
    Search,
    Square,
    Star,
    Tag,
    Trash2,
    TrendingUp,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Category { id: number; name: string }
interface AddonGroupOption { id: number; name: string; is_required: boolean }
interface MenuItemVariation { id?: number; name: string; price: number | string; sort_order?: number }
interface MenuItem {
    id: number;
    name: string;
    description: string | null;
    price: number;
    display_price?: number;
    has_variations?: boolean;
    variations?: MenuItemVariation[];
    image_url: string | null;
    is_available: boolean;
    is_featured: boolean;
    category_id: number;
    sort_order: number;
    category?: { name: string };
    addon_groups?: { id: number; name: string }[];
}

interface Stats {
    total: number;
    available: number;
    unavailable: number;
    featured: number;
    categories: number;
}

interface Filters {
    search?: string;
    category_id?: string;
    availability?: string;
    featured?: string;
}

interface Props {
    items: MenuItem[];
    categories: Category[];
    addon_groups: AddonGroupOption[];
    filters: Filters;
    stats: Stats;
    can: { manage_menu_items: boolean };
}

type BulkType = 'percent_increase' | 'percent_decrease' | 'fixed';

export default function MenuItemsIndex({ items, categories, addon_groups, filters, stats, can }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MenuItem | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selected, setSelected] = useState<Set<number>>(new Set());
    const allSelected = items.length > 0 && selected.size === items.length;
    const someSelected = selected.size > 0 && selected.size < items.length;

    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkType, setBulkType] = useState<BulkType>('percent_increase');
    const [bulkValue, setBulkValue] = useState('');
    const [bulkProcessing, setBulkProcessing] = useState(false);

    const [localItems, setLocalItems] = useState<MenuItem[]>(items);

    useEffect(() => { setLocalItems(items); }, [items]);

    const [search, setSearch] = useState(filters.search ?? '');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? '');
    const [availability, setAvailability] = useState(filters.availability ?? '');
    const [featured, setFeatured] = useState(filters.featured === '1');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFiltered = !!(filters.search || filters.category_id || filters.availability || filters.featured);

    function applyFilters(overrides: Partial<{ search: string; category_id: string; availability: string; featured: string }> = {}) {
        const params: Record<string, string> = {};
        const s = overrides.search ?? search;
        const c = overrides.category_id ?? categoryId;
        const a = overrides.availability ?? availability;
        const f = overrides.featured !== undefined ? overrides.featured : featured ? '1' : '';
        if (s) params.search = s;
        if (c) params.category_id = c;
        if (a) params.availability = a;
        if (f) params.featured = f;
        router.get(adminMenuItemsIndex(), params, { preserveState: true, replace: true, onSuccess: () => setSelected(new Set()) });
    }

    function clearFilters() {
        setSearch(''); setCategoryId(''); setAvailability(''); setFeatured(false);
        router.get(adminMenuItemsIndex(), {}, { preserveState: false, replace: true, onSuccess: () => setSelected(new Set()) });
    }

    function onSearchChange(value: string) {
        setSearch(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => applyFilters({ search: value }), 400);
    }

    const { data, setData, post, processing, reset } = useForm<{
        category_id: string;
        name: string;
        description: string;
        price: string;
        is_available: boolean;
        is_featured: boolean;
        sort_order: string;
        image: File | null;
        addon_group_ids: number[];
        variations: MenuItemVariation[];
        _method?: string;
    }>({
        category_id: '', name: '', description: '', price: '',
        is_available: true, is_featured: false, sort_order: '0',
        image: null, addon_group_ids: [], variations: [],
    });

    const usesVariations = data.variations.length > 0;

    function openCreate() {
        reset(); setData('variations', []); setEditing(null); setImagePreview(null); setModalOpen(true);
    }

    function openEdit(item: MenuItem) {
        setEditing(item);
        setImagePreview(item.image_url ?? null);
        setData({
            category_id: String(item.category_id), name: item.name, description: item.description ?? '',
            price: String(item.price), is_available: item.is_available, is_featured: item.is_featured,
            sort_order: String(item.sort_order), image: null,
            addon_group_ids: item.addon_groups?.map((g) => g.id) ?? [],
            variations: item.variations?.map((v) => ({ name: v.name, price: String(v.price), sort_order: v.sort_order })) ?? [],
            _method: 'PUT',
        });
        setModalOpen(true);
    }

    function addVariation() {
        setData('variations', [...data.variations, { name: '', price: '', sort_order: data.variations.length }]);
    }

    function updateVariation(index: number, field: keyof MenuItemVariation, value: string | number) {
        const updated = [...data.variations];
        updated[index] = { ...updated[index], [field]: value };
        setData('variations', updated);
    }

    function removeVariation(index: number) {
        setData('variations', data.variations.filter((_, i) => i !== index));
    }

    function onFileChange(file: File | null) {
        setData('image', file);
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setImagePreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setImagePreview(editing?.image_url ?? null);
        }
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminMenuItemsUpdate(editing.id) : adminMenuItemsStore();
        post(url, { forceFormData: true, onSuccess: () => { setModalOpen(false); toast.success(editing ? 'Item updated!' : 'Item created!'); } });
    }

    function toggleAddonGroup(id: number) {
        setData('addon_group_ids', data.addon_group_ids.includes(id)
            ? data.addon_group_ids.filter((x) => x !== id)
            : [...data.addon_group_ids, id]);
    }

    function toggleSelect(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else { next.add(id); }
            return next;
        });
    }

    function toggleSelectAll() {
        if (allSelected) { setSelected(new Set()); } else { setSelected(new Set(items.map((i) => i.id))); }
    }

    function handleToggleAvailability(item: MenuItem) {
        const prevItems = [...localItems];
        setLocalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_available: !i.is_available } : i));

        fetch(adminMenuItemsToggleAvailability(item.id), {
            method: 'PATCH',
            headers: {
                'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                Accept: 'application/json',
            },
        }).then((r) => {
            if (!r.ok) throw new Error();
            return r.json();
        }).then((d) => {
            setLocalItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_available: d.is_available } : i));
            toast.success(`${item.name} marked ${d.is_available ? 'available' : 'unavailable'}`);
        }).catch(() => {
            setLocalItems(prevItems);
            toast.error('Failed to update availability');
        });
    }

    function applyBulkPrice() {
        if (!bulkValue || Number(bulkValue) < 0) { toast.error('Enter a valid value'); return; }
        setBulkProcessing(true);
        router.post(adminMenuItemsBulkPriceUpdate(), { ids: Array.from(selected), type: bulkType, value: bulkValue }, {
            onSuccess: () => {
                toast.success(`Prices updated for ${selected.size} item(s)`);
                setSelected(new Set()); setBulkOpen(false); setBulkValue(''); setBulkProcessing(false);
            },
            onError: () => { toast.error('Failed to update prices'); setBulkProcessing(false); },
        });
    }

    const bulkTypeLabel: Record<BulkType, string> = {
        percent_increase: '% Increase',
        percent_decrease: '% Decrease',
        fixed: 'Set Fixed Price',
    };

    return (
        <AdminLayout>
            <Head title="Menu Items — Admin" />
            <Toaster position="top-right" />

            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Menu Items</h1>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {isFiltered ? `${localItems.length} of ${stats.total} items` : `${stats.total} items total`}
                        </p>
                    </div>
                    {can.manage_menu_items && (
                        <button onClick={openCreate} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:opacity-90" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                            <Plus className="h-4 w-4" /> Add Item
                        </button>
                    )}
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {([
                        { label: 'Total Items', value: stats.total, Icon: Package, color: '#6366F1' },
                        { label: 'Available', value: stats.available, Icon: Coffee, color: '#22C55E' },
                        { label: 'Unavailable', value: stats.unavailable, Icon: Coffee, color: '#EF4444' },
                        { label: 'Featured', value: stats.featured, Icon: Star, color: '#D4A843' },
                    ] as const).map(({ label, value, Icon, color }) => (
                        <div key={label} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
                                <Icon className="h-5 w-5" style={{ color }} />
                            </div>
                            <div>
                                <p className="text-lg font-bold leading-tight" style={{ color: 'var(--ap-input-text)' }}>{value}</p>
                                <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-52 flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }} />
                        <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search items..." className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                        {search && <button onClick={() => { setSearch(''); applyFilters({ search: '' }); }} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} /></button>}
                    </div>
                    <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); applyFilters({ category_id: e.target.value }); }} className="rounded-xl py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}>
                        <option value="">All Categories</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={availability} onChange={(e) => { setAvailability(e.target.value); applyFilters({ availability: e.target.value }); }} className="rounded-xl py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}>
                        <option value="">All Status</option>
                        <option value="1">Available</option>
                        <option value="0">Unavailable</option>
                    </select>
                    <button onClick={() => { const next = !featured; setFeatured(next); applyFilters({ featured: next ? '1' : '' }); }} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all" style={{ background: featured ? '#D4A84320' : 'var(--ap-card)', border: `1px solid ${featured ? '#D4A843' : 'var(--ap-border)'}`, color: featured ? '#D4A843' : 'var(--ap-muted)' }}>
                        <Star className="h-3.5 w-3.5" fill={featured ? '#D4A843' : 'none'} />Featured
                    </button>
                    {isFiltered && <button onClick={clearFilters} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ color: 'var(--ap-muted)', border: '1px solid var(--ap-border)', background: 'var(--ap-card)' }}><X className="h-3.5 w-3.5" /> Clear</button>}
                </div>

                {/* Bulk action bar */}
                <AnimatePresence>
                    {selected.size > 0 && can.manage_menu_items && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3" style={{ background: '#2C1A0E', border: '1px solid #3d2410' }}>
                            <span className="text-sm font-semibold" style={{ color: '#D4A843' }}>{selected.size} selected</span>
                            <div className="flex-1" />
                            <button onClick={() => { setBulkOpen((v) => !v); setBulkValue(''); }} className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-medium" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                <TrendingUp className="h-3.5 w-3.5" />
                                Bulk Price Update
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${bulkOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <button onClick={() => setSelected(new Set())} className="rounded-xl px-3 py-1.5 text-sm" style={{ color: '#D4A84380', border: '1px solid #D4A84330' }}>Deselect</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bulk price panel */}
                <AnimatePresence>
                    {bulkOpen && selected.size > 0 && can.manage_menu_items && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <div className="p-4">
                                <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>Bulk Price Update — {selected.size} item{selected.size !== 1 ? 's' : ''}</p>
                                <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>Adjustment type</label>
                                        <div className="flex overflow-hidden rounded-xl" style={{ border: '1px solid var(--ap-border)' }}>
                                            {(['percent_increase', 'percent_decrease', 'fixed'] as BulkType[]).map((t, i) => (
                                                <button key={t} onClick={() => setBulkType(t)} className="px-3 py-2 text-xs font-medium transition-all" style={{ background: bulkType === t ? '#2C1A0E' : 'var(--ap-card)', color: bulkType === t ? '#D4A843' : 'var(--ap-muted)', borderRight: i < 2 ? '1px solid var(--ap-border)' : undefined }}>
                                                    {bulkTypeLabel[t]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>{bulkType === 'fixed' ? 'New price (₱)' : 'Percentage (%)'}</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                                {bulkType === 'fixed' ? '₱' : <Percent className="h-3.5 w-3.5" />}
                                            </span>
                                            <input type="number" min="0" step={bulkType === 'fixed' ? '0.01' : '1'} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder={bulkType === 'fixed' ? '0.00' : '0'} className="w-36 rounded-xl py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                                        </div>
                                    </div>
                                    {bulkValue && Number(bulkValue) > 0 && (
                                        <p className="pb-2 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                            {bulkType === 'percent_increase' && `Prices will increase by ${bulkValue}%`}
                                            {bulkType === 'percent_decrease' && `Prices will decrease by ${bulkValue}%`}
                                            {bulkType === 'fixed' && `All selected prices set to ₱${Number(bulkValue).toFixed(2)}`}
                                        </p>
                                    )}
                                    <button onClick={applyBulkPrice} disabled={bulkProcessing || !bulkValue} className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                        {bulkProcessing ? 'Applying...' : 'Apply'}
                                    </button>
                                    <button onClick={() => { setBulkOpen(false); setBulkValue(''); }} className="rounded-xl px-3 py-2 text-sm" style={{ color: 'var(--ap-muted)', border: '1px solid var(--ap-border)' }}>Cancel</button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Table */}
                <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                                {can.manage_menu_items && (
                                    <th className="w-10 px-4 py-3">
                                        <button onClick={toggleSelectAll} className="flex items-center justify-center">
                                            {allSelected ? (
                                                <CheckSquare className="h-4 w-4" style={{ color: '#D4A843' }} />
                                            ) : someSelected ? (
                                                <div className="flex h-4 w-4 items-center justify-center rounded" style={{ background: '#D4A84340', border: '1.5px solid #D4A843' }}>
                                                    <div className="h-2 w-2 rounded-sm" style={{ background: '#D4A843' }} />
                                                </div>
                                            ) : (
                                                <Square className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                            )}
                                        </button>
                                    </th>
                                )}
                                {['Item', 'Category', 'Price', 'Add-ons', 'Availability', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {localItems.length === 0 ? (
                                <tr>
                                    <td colSpan={can.manage_menu_items ? 7 : 6} className="px-4 py-16 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Tag className="h-10 w-10 opacity-30" style={{ color: 'var(--ap-muted)' }} />
                                            <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>{isFiltered ? 'No items match your filters.' : 'No menu items yet.'}</p>
                                            {can.manage_menu_items && !isFiltered && <button onClick={openCreate} className="mt-1 text-sm font-medium" style={{ color: '#D4A843' }}>Add your first item</button>}
                                        </div>
                                    </td>
                                </tr>
                            ) : localItems.map((item) => (
                                <tr key={item.id} className="border-t transition-colors" style={{ borderColor: 'var(--ap-border)', background: selected.has(item.id) ? '#D4A84308' : undefined }}>
                                    {can.manage_menu_items && (
                                        <td className="w-10 px-4 py-3">
                                            <button onClick={() => toggleSelect(item.id)}>
                                                {selected.has(item.id) ? <CheckSquare className="h-4 w-4" style={{ color: '#D4A843' }} /> : <Square className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />}
                                            </button>
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg" style={{ background: 'var(--ap-bg)' }}>
                                                {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : '☕'}
                                            </div>
                                            <div>
                                                <p className="font-semibold" style={{ color: 'var(--ap-input-text)' }}>{item.name}</p>
                                                <div className="mt-0.5 flex items-center gap-1.5">
                                                    {item.is_featured && <span className="flex items-center gap-0.5 text-xs" style={{ color: '#D4A843' }}><Star className="h-2.5 w-2.5" fill="#D4A843" /> Featured</span>}
                                                    {item.has_variations && <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>· {item.variations?.length} sizes</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ap-muted)' }}>{item.category?.name ?? '—'}</td>
                                    <td className="px-4 py-3 font-bold" style={{ color: '#D4A843' }}>
                                        {item.has_variations && item.variations && item.variations.length > 1
                                            ? `₱${Math.min(...item.variations.map((v) => Number(v.price))).toFixed(2)} – ₱${Math.max(...item.variations.map((v) => Number(v.price))).toFixed(2)}`
                                            : `₱${Number(item.display_price ?? item.price).toFixed(2)}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.addon_groups && item.addon_groups.length > 0 ? (
                                            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#3B82F620', color: '#3B82F6' }}>{item.addon_groups.length} group{item.addon_groups.length !== 1 ? 's' : ''}</span>
                                        ) : <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        {can.manage_menu_items ? (
                                            <button onClick={() => handleToggleAvailability(item)} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all" style={{ background: item.is_available ? '#22C55E15' : '#EF444415', color: item.is_available ? '#22C55E' : '#EF4444', border: `1px solid ${item.is_available ? '#22C55E30' : '#EF444430'}` }}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-red-400'}`} />
                                                {item.is_available ? 'Available' : 'Unavailable'}
                                            </button>
                                        ) : (
                                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {item.is_available ? 'Available' : 'Unavailable'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {can.manage_menu_items && (
                                            <div className="flex gap-1">
                                                <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100" title="Edit"><Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                                                <button onClick={() => { if (confirm(`Delete "${item.name}"?`)) router.delete(adminMenuItemsDestroy(item.id)); }} className="rounded-lg p-1.5 transition-colors hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4 text-red-400" /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60, maxHeight: '90vh' }}>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{editing ? 'Edit Item' : 'New Menu Item'}</h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4" encType="multipart/form-data">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Category *</label>
                                        <select value={data.category_id} onChange={(e) => setData('category_id', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none">
                                            <option value="">Select...</option>
                                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    {!usesVariations && (
                                        <div>
                                            <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Price (₱) *</label>
                                            <input type="number" step="0.01" value={data.price} onChange={(e) => setData('price', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Description</label>
                                    <textarea value={data.description} onChange={(e) => setData('description', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" rows={3} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Image</label>
                                    <div className="flex items-start gap-3">
                                        <div className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors hover:border-yellow-400" style={{ borderColor: imagePreview ? 'transparent' : 'var(--ap-border)', background: 'var(--ap-bg)' }} onClick={() => fileInputRef.current?.click()}>
                                            {imagePreview ? (
                                                <>
                                                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100"><ImagePlus className="h-5 w-5 text-white" /></div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-center">
                                                    <ImagePlus className="h-6 w-6" style={{ color: '#D4A843' }} />
                                                    <span className="text-[10px]" style={{ color: 'var(--ap-muted)' }}>Upload</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>Click the box to {imagePreview ? 'change' : 'upload'} an image.<br />JPG, PNG or WEBP · Max 2MB</p>
                                            {imagePreview && <button type="button" onClick={() => { onFileChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="mt-2 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"><X className="h-3 w-3" /> Remove image</button>}
                                        </div>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ap-input-text)' }}>
                                        <input type="checkbox" checked={data.is_available} onChange={(e) => setData('is_available', e.target.checked)} />Available
                                    </label>
                                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ap-input-text)' }}>
                                        <input type="checkbox" checked={data.is_featured} onChange={(e) => setData('is_featured', e.target.checked)} />Featured
                                    </label>
                                </div>
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Size Variations</label>
                                        <button type="button" onClick={addVariation} className="text-xs font-medium" style={{ color: '#D4A843' }}>+ Add size</button>
                                    </div>
                                    {usesVariations ? (
                                        <div className="space-y-2">
                                            {data.variations.map((variation, index) => (
                                                <div key={index} className="flex gap-2">
                                                    <input value={variation.name} onChange={(e) => updateVariation(index, 'name', e.target.value)} placeholder="e.g., Medium" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                                    <input type="number" step="0.01" value={variation.price} onChange={(e) => updateVariation(index, 'price', e.target.value)} placeholder="Price" className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                                    <button type="button" onClick={() => removeVariation(index)}><X className="h-4 w-4 text-red-400" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>Add sizes with their own prices, or leave empty to use a single price above.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Add-on Groups</label>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {addon_groups.filter((g) => !usesVariations || g.name.toLowerCase() !== 'size').map((g) => (
                                            <button key={g.id} type="button" onClick={() => toggleAddonGroup(g.id)} className="rounded-full px-3 py-1 text-xs font-medium transition-all" style={{ background: data.addon_group_ids.includes(g.id) ? '#2C1A0E' : 'var(--ap-bg)', color: data.addon_group_ids.includes(g.id) ? '#D4A843' : 'var(--ap-muted)', border: data.addon_group_ids.includes(g.id) ? 'none' : '1px solid var(--ap-border)' }}>
                                                {g.name} {g.is_required ? '*' : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Item'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
