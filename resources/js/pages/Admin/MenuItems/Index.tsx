import { Head, router, useForm } from '@inertiajs/react';
import { adminMenuItemsDestroy, adminMenuItemsIndex, adminMenuItemsStore, adminMenuItemsUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, ImagePlus, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
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
    total_count: number;
}

export default function MenuItemsIndex({ items, categories, addon_groups, filters, total_count }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MenuItem | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Filters ──────────────────────────────────────────────────────────
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
        router.get(adminMenuItemsIndex(), params, { preserveState: true, replace: true });
    }

    function clearFilters() {
        setSearch('');
        setCategoryId('');
        setAvailability('');
        setFeatured(false);
        router.get(adminMenuItemsIndex(), {}, { preserveState: false, replace: true });
    }

    function onSearchChange(value: string) {
        setSearch(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => applyFilters({ search: value }), 400);
    }

    const { data, setData, post, processing, errors, reset } = useForm<{
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
        category_id: '',
        name: '',
        description: '',
        price: '',
        is_available: true,
        is_featured: false,
        sort_order: '0',
        image: null,
        addon_group_ids: [],
        variations: [],
    });

    const usesVariations = data.variations.length > 0;

    function openCreate() {
        reset();
        setData('variations', []);
        setEditing(null);
        setImagePreview(null);
        setModalOpen(true);
    }

    function openEdit(item: MenuItem) {
        setEditing(item);
        setImagePreview(item.image_url ?? null);
        setData({
            category_id: String(item.category_id),
            name: item.name,
            description: item.description ?? '',
            price: String(item.price),
            is_available: item.is_available,
            is_featured: item.is_featured,
            sort_order: String(item.sort_order),
            image: null,
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

    return (
        <AdminLayout>
            <Head title="Menu Items — Admin" />
            <Toaster position="top-right" />

            <div className="p-6">
                {/* Page header */}
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Menu Items</h1>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {isFiltered ? `${items.length} of ${total_count} items` : `${total_count} items total`}
                        </p>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all hover:opacity-90" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Item
                    </button>
                </div>

                {/* Filter bar */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative min-w-52 flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search items..."
                            className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                        />
                        {search && (
                            <button onClick={() => { setSearch(''); applyFilters({ search: '' }); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <X className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                            </button>
                        )}
                    </div>

                    {/* Category */}
                    <select
                        value={categoryId}
                        onChange={(e) => { setCategoryId(e.target.value); applyFilters({ category_id: e.target.value }); }}
                        className="rounded-xl py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                    >
                        <option value="">All Categories</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    {/* Availability */}
                    <select
                        value={availability}
                        onChange={(e) => { setAvailability(e.target.value); applyFilters({ availability: e.target.value }); }}
                        className="rounded-xl py-2.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                    >
                        <option value="">All Status</option>
                        <option value="1">Available</option>
                        <option value="0">Unavailable</option>
                    </select>

                    {/* Featured toggle */}
                    <button
                        onClick={() => { const next = !featured; setFeatured(next); applyFilters({ featured: next ? '1' : '' }); }}
                        className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all"
                        style={{
                            background: featured ? '#D4A84320' : 'var(--ap-card)',
                            border: `1px solid ${featured ? '#D4A843' : 'var(--ap-border)'}`,
                            color: featured ? '#D4A843' : 'var(--ap-muted)',
                        }}
                    >
                        <Star className="h-3.5 w-3.5" fill={featured ? '#D4A843' : 'none'} />
                        Featured
                    </button>

                    {/* Clear */}
                    {isFiltered && (
                        <button onClick={clearFilters} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium" style={{ color: 'var(--ap-muted)', border: '1px solid var(--ap-border)', background: 'var(--ap-card)' }}>
                            <X className="h-3.5 w-3.5" /> Clear
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                                {['Item', 'Category', 'Price', 'Add-ons', 'Status', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>
                                        {isFiltered ? 'No items match your filters.' : 'No menu items yet.'}
                                    </td>
                                </tr>
                            ) : items.map((item) => (
                                <tr key={item.id} className="border-t transition-colors" style={{ borderColor: 'var(--ap-border)' }}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg" style={{ background: 'var(--ap-bg)' }}>
                                                {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : '☕'}
                                            </div>
                                            <div>
                                                <p className="font-semibold" style={{ color: 'var(--ap-input-text)' }}>{item.name}</p>
                                                {item.is_featured && (
                                                    <span className="flex items-center gap-0.5 text-xs" style={{ color: '#D4A843' }}>
                                                        <Star className="h-2.5 w-2.5" fill="#D4A843" /> Featured
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                        {item.category?.name ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 font-bold" style={{ color: '#D4A843' }}>
                                        {item.has_variations && item.variations && item.variations.length > 1
                                            ? `₱${Math.min(...item.variations.map((v) => Number(v.price))).toFixed(2)} – ₱${Math.max(...item.variations.map((v) => Number(v.price))).toFixed(2)}`
                                            : `₱${Number(item.display_price ?? item.price).toFixed(2)}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.addon_groups && item.addon_groups.length > 0 ? (
                                            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#3B82F620', color: '#3B82F6' }}>
                                                {item.addon_groups.length} group{item.addon_groups.length !== 1 ? 's' : ''}
                                            </span>
                                        ) : (
                                            <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {item.is_available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100" title="Edit">
                                                <Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                            </button>
                                            <button
                                                onClick={() => { if (confirm(`Delete "${item.name}"?`)) { router.delete(adminMenuItemsDestroy(item.id)); } }}
                                                className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-400" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60, maxHeight: '90vh' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{editing ? 'Edit Item' : 'New Menu Item'}</h2>
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
                                {/* Image upload with preview */}
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Image</label>
                                    <div className="flex items-start gap-3">
                                        {/* Preview box */}
                                        <div
                                            className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors hover:border-yellow-400"
                                            style={{ borderColor: imagePreview ? 'transparent' : 'var(--ap-border)', background: 'var(--ap-bg)' }}
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {imagePreview ? (
                                                <>
                                                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                                                        <ImagePlus className="h-5 w-5 text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-center">
                                                    <ImagePlus className="h-6 w-6" style={{ color: '#D4A843' }} />
                                                    <span className="text-[10px]" style={{ color: 'var(--ap-muted)' }}>Upload</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Text & controls */}
                                        <div className="flex-1">
                                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>
                                                Click the box to {imagePreview ? 'change' : 'upload'} an image.<br />
                                                JPG, PNG or WEBP · Max 2MB
                                            </p>
                                            {imagePreview && (
                                                <button
                                                    type="button"
                                                    onClick={() => { onFileChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                                    className="mt-2 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                                                >
                                                    <X className="h-3 w-3" /> Remove image
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ap-input-text)' }}>
                                        <input type="checkbox" checked={data.is_available} onChange={(e) => setData('is_available', e.target.checked)} />
                                        Available
                                    </label>
                                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ap-input-text)' }}>
                                        <input type="checkbox" checked={data.is_featured} onChange={(e) => setData('is_featured', e.target.checked)} />
                                        Featured
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
                                                    <input
                                                        value={variation.name}
                                                        onChange={(e) => updateVariation(index, 'name', e.target.value)}
                                                        placeholder="e.g., Medium"
                                                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                                    />
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={variation.price}
                                                        onChange={(e) => updateVariation(index, 'price', e.target.value)}
                                                        placeholder="Price"
                                                        className="w-28 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                                    />
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
