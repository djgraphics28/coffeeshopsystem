import { Head, router, useForm } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckSquare,
    ChevronDown,
    Coffee,
    Edit2,
    FileSpreadsheet,
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
import { useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FilterPanel, FilterToggleButton } from '@/components/admin/filter-panel';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { MenuImportDialog } from '@/components/admin/menu-import-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import {
    adminMenuItemsBulkPriceUpdate,
    adminMenuItemsDestroy,
    adminMenuItemsIndex,
    adminMenuItemsStore,
    adminMenuItemsToggleAvailability,
    adminMenuItemsUpdate,
} from '@/lib/routes';
import { cn } from '@/lib/utils';

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
    is_kitchen: boolean;
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
    kitchen?: string;
}

interface Props {
    items: MenuItem[];
    categories: Category[];
    addon_groups: AddonGroupOption[];
    filters: Filters;
    stats: Stats;
    can: { manage_menu_items: boolean; import_menu_items: boolean };
}

type BulkType = 'percent_increase' | 'percent_decrease' | 'fixed_increase' | 'fixed_decrease' | 'per_variation';

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
    const [bulkVariationPrices, setBulkVariationPrices] = useState<Record<string, string>>({});
    const [bulkSizes, setBulkSizes] = useState<string[]>([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Optimistic availability overrides layered over the server data (cleared naturally when props refresh).
    const [availabilityOverrides, setAvailabilityOverrides] = useState<Record<number, boolean>>({});
    const localItems = items.map((i) => (i.id in availabilityOverrides ? { ...i, is_available: availabilityOverrides[i.id] } : i));
    const currency = '₱';
    const [importOpen, setImportOpen] = useState(false);
    const [deleting, setDeleting] = useState<MenuItem | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [search, setSearch] = useState(filters.search ?? '');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? '');
    const [availability, setAvailability] = useState(filters.availability ?? '');
    const [featured, setFeatured] = useState(filters.featured === '1');
    const [kitchen, setKitchen] = useState(filters.kitchen ?? '');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFiltered = !!(filters.search || filters.category_id || filters.availability || filters.featured || filters.kitchen);
    const activeFilterCount = [filters.search, filters.category_id, filters.availability, filters.featured, filters.kitchen].filter(Boolean).length;
    const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

    function applyFilters(overrides: Partial<{ search: string; category_id: string; availability: string; featured: string; kitchen: string }> = {}) {
        const params: Record<string, string> = {};
        const s = overrides.search ?? search;
        const c = overrides.category_id ?? categoryId;
        const a = overrides.availability ?? availability;
        const f = overrides.featured !== undefined ? overrides.featured : featured ? '1' : '';

        if (s) {
params.search = s;
}

        if (c) {
params.category_id = c;
}

        if (a) {
params.availability = a;
}

        if (f) {
params.featured = f;
}

        const k = overrides.kitchen ?? kitchen;

        if (k) {
params.kitchen = k;
}

        router.get(adminMenuItemsIndex(), params, { preserveState: true, replace: true, onSuccess: () => setSelected(new Set()) });
    }

    function clearFilters() {
        setSearch(''); setCategoryId(''); setAvailability(''); setFeatured(false); setKitchen('');
        router.get(adminMenuItemsIndex(), {}, { preserveState: false, replace: true, onSuccess: () => setSelected(new Set()) });
    }

    function onSearchChange(value: string) {
        setSearch(value);

        if (searchTimer.current) {
clearTimeout(searchTimer.current);
}

        searchTimer.current = setTimeout(() => applyFilters({ search: value }), 400);
    }

    const { data, setData, post, processing, reset, errors, clearErrors } = useForm<{
        category_id: string;
        name: string;
        description: string;
        price: string;
        is_available: boolean;
        is_featured: boolean;
        is_kitchen: boolean;
        sort_order: string;
        image: File | null;
        addon_group_ids: number[];
        variations: MenuItemVariation[];
        _method?: string;
    }>({
        category_id: '', name: '', description: '', price: '',
        is_available: true, is_featured: false, is_kitchen: true, sort_order: '0',
        image: null, addon_group_ids: [], variations: [],
    });

    const usesVariations = data.variations.length > 0;

    function openCreate() {
        reset(); clearErrors(); setData('variations', []); setEditing(null); setImagePreview(null); setModalOpen(true);
    }

    function openEdit(item: MenuItem) {
        clearErrors();
        setEditing(item);
        setImagePreview(item.image_url ?? null);
        setData({
            category_id: String(item.category_id), name: item.name, description: item.description ?? '',
            price: String(item.price), is_available: item.is_available, is_featured: item.is_featured, is_kitchen: item.is_kitchen ?? true,
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
        post(url, { forceFormData: true, onSuccess: () => {
 setModalOpen(false); toast.success(editing ? 'Item updated!' : 'Item created!'); 
} });
    }

    function toggleAddonGroup(id: number) {
        setData('addon_group_ids', data.addon_group_ids.includes(id)
            ? data.addon_group_ids.filter((x) => x !== id)
            : [...data.addon_group_ids, id]);
    }

    function toggleSelect(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
 next.delete(id); 
} else {
 next.add(id); 
}

            return next;
        });
    }

    function toggleSelectAll() {
        if (allSelected) {
 setSelected(new Set()); 
} else {
 setSelected(new Set(items.map((i) => i.id))); 
}
    }

    function handleToggleAvailability(item: MenuItem) {
        const previous = item.is_available;
        setAvailabilityOverrides((prev) => ({ ...prev, [item.id]: !previous }));

        fetch(adminMenuItemsToggleAvailability(item.id), {
            method: 'PATCH',
            headers: {
                'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                Accept: 'application/json',
            },
        }).then((r) => {
            if (!r.ok) {
 throw new Error(); 
}

            return r.json();
        }).then((d) => {
            setAvailabilityOverrides((prev) => ({ ...prev, [item.id]: d.is_available }));
            toast.success(`${item.name} marked ${d.is_available ? 'available' : 'unavailable'}`);
        }).catch(() => {
            setAvailabilityOverrides((prev) => ({ ...prev, [item.id]: previous }));
            toast.error('Failed to update availability');
        });
    }

    function confirmDelete() {
        if (!deleting) {
 return; 
}

        router.delete(adminMenuItemsDestroy(deleting.id), {
            preserveScroll: true,
            onStart: () => setDeleteLoading(true),
            onFinish: () => {
 setDeleteLoading(false); setDeleting(null); 
},
        });
    }

    // Unique variation names across all currently selected items (preserving first-seen order)
    const selectedVariationNames: string[] = Array.from(
        localItems
            .filter((i) => selected.has(i.id) && i.has_variations && i.variations && i.variations.length > 0)
            .flatMap((i) => i.variations!.map((v) => v.name))
            .reduce((set, name) => set.add(name), new Set<string>())
    );
    const hasSelectedWithVariations = selectedVariationNames.length > 0;

    // Sizes the % / amount adjustment is limited to (empty = every size and every item).
    const activeBulkSizes = bulkSizes.filter((n) => selectedVariationNames.includes(n));

    function adjustPrice(price: number, type: BulkType, value: number): number {
        const next = type === 'percent_increase' ? price * (1 + value / 100)
            : type === 'percent_decrease' ? price * (1 - value / 100)
            : type === 'fixed_increase' ? price + value
            : price - value;

        return Math.round(Math.max(0, next) * 100) / 100;
    }

    // Before → after preview of what Apply will do.
    const bulkPreview: { key: string; label: string; from: number; to: number }[] = [];
    const bulkNumber = parseFloat(bulkValue);

    if (selected.size > 0) {
        for (const item of localItems.filter((i) => selected.has(i.id))) {
            if (bulkType === 'per_variation') {
                for (const v of item.variations ?? []) {
                    const target = parseFloat(bulkVariationPrices[v.name] ?? '');

                    if (!isNaN(target) && target > 0 && target !== Number(v.price)) {
                        bulkPreview.push({ key: `${item.id}-${v.name}`, label: `${item.name} · ${v.name}`, from: Number(v.price), to: target });
                    }
                }
            } else if (!isNaN(bulkNumber) && bulkNumber > 0) {
                if (item.variations && item.variations.length > 0) {
                    for (const v of item.variations) {
                        if (activeBulkSizes.length === 0 || activeBulkSizes.includes(v.name)) {
                            bulkPreview.push({ key: `${item.id}-${v.name}`, label: `${item.name} · ${v.name}`, from: Number(v.price), to: adjustPrice(Number(v.price), bulkType, bulkNumber) });
                        }
                    }
                } else if (activeBulkSizes.length === 0) {
                    bulkPreview.push({ key: `${item.id}`, label: item.name, from: Number(item.price), to: adjustPrice(Number(item.price), bulkType, bulkNumber) });
                }
            }
        }
    }

    function applyBulkPrice() {
        setBulkProcessing(true);

        if (bulkType === 'per_variation') {
            const prices: Record<string, number> = {};

            for (const name of selectedVariationNames) {
                const val = parseFloat(bulkVariationPrices[name] ?? '');

                if (!isNaN(val) && val > 0) {
prices[name] = val;
}
            }

            if (Object.keys(prices).length === 0) {
 toast.error('Enter at least one size price'); setBulkProcessing(false);

 return; 
}

            router.post(adminMenuItemsBulkPriceUpdate(), { ids: Array.from(selected), type: 'per_variation', prices }, {
                onSuccess: () => {
                    toast.success(`Prices updated for ${selected.size} item(s)`);
                    setSelected(new Set()); setBulkOpen(false); setBulkVariationPrices({}); setBulkProcessing(false);
                },
                onError: () => {
 toast.error('Failed to update prices'); setBulkProcessing(false); 
},
            });
        } else {
            if (!bulkValue || Number(bulkValue) < 0) {
 toast.error('Enter a valid value'); setBulkProcessing(false);

 return; 
}

            router.post(adminMenuItemsBulkPriceUpdate(), { ids: Array.from(selected), type: bulkType, value: bulkValue, sizes: activeBulkSizes }, {
                onSuccess: () => {
                    toast.success(`Prices updated for ${selected.size} item(s)`);
                    setSelected(new Set()); setBulkOpen(false); setBulkValue(''); setBulkSizes([]); setBulkProcessing(false);
                },
                onError: () => {
 toast.error('Failed to update prices'); setBulkProcessing(false); 
},
            });
        }
    }

    const bulkTypeLabel: Record<BulkType, string> = {
        percent_increase: '% Increase',
        percent_decrease: '% Decrease',
        fixed_increase: '+₱ Amount',
        fixed_decrease: '-₱ Amount',
        per_variation: 'Per Size',
    };

    const statCards = [
        { label: 'Total Items', value: stats.total, Icon: Package, tone: 'brand' as const },
        { label: 'Available', value: stats.available, Icon: Coffee, tone: 'success' as const },
        { label: 'Unavailable', value: stats.unavailable, Icon: Coffee, tone: 'error' as const },
        { label: 'Featured', value: stats.featured, Icon: Star, tone: 'warning' as const },
    ];
    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        warning: 'bg-warning/10 text-warning',
        success: 'bg-success/10 text-success',
        error: 'bg-error/10 text-error',
    };

    return (
        <AdminLayout>
            <Head title="Menu Items" />
            <Toaster position="top-right" />

            <div className="space-y-5">
                <PageHeader
                    title="Menu Items"
                    breadcrumbs={[{ label: 'Menu Items' }]}
                    actions={
                        <>
                            <FilterToggleButton open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} activeCount={activeFilterCount} />
                            {can.import_menu_items && (
                                <Button variant="outline" onClick={() => setImportOpen(true)}>
                                    <FileSpreadsheet className="h-4 w-4" /> Import
                                </Button>
                            )}
                            {can.manage_menu_items && (
                                <Button onClick={openCreate}>
                                    <Plus className="h-4 w-4" /> Add Item
                                </Button>
                            )}
                        </>
                    }
                />
                <p className="-mt-4 text-sm text-muted-foreground">
                    {isFiltered ? `${localItems.length} of ${stats.total} items` : `${stats.total} items total`}
                </p>

                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {statCards.map(({ label, value, Icon, tone }) => (
                        <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneClasses[tone])}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-lg leading-tight font-bold text-foreground">{value}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <FilterPanel open={filtersOpen}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <FormField label="Search">
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input type="search" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search items…" className={adminFieldClass() + ' pl-9'} />
                            </div>
                        </FormField>
                        <FormField label="Category">
                            <select value={categoryId} onChange={(e) => {
 setCategoryId(e.target.value); applyFilters({ category_id: e.target.value }); 
}} className={adminFieldClass()}>
                                <option value="">All categories</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Availability">
                            <select value={availability} onChange={(e) => {
 setAvailability(e.target.value); applyFilters({ availability: e.target.value }); 
}} className={adminFieldClass()}>
                                <option value="">All</option>
                                <option value="1">Available</option>
                                <option value="0">Unavailable</option>
                            </select>
                        </FormField>
                        <FormField label="Station">
                            <select value={kitchen} onChange={(e) => {
 setKitchen(e.target.value); applyFilters({ kitchen: e.target.value }); 
}} className={adminFieldClass()}>
                                <option value="">All</option>
                                <option value="1">Kitchen</option>
                                <option value="0">Barista</option>
                            </select>
                        </FormField>
                        <div className="flex flex-wrap items-end gap-2">
                            <button
                                type="button"
                                aria-pressed={featured}
                                onClick={() => {
 const next = !featured; setFeatured(next); applyFilters({ featured: next ? '1' : '' }); 
}}
                                className={cn(
                                    'flex h-[42px] min-w-28 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-all',
                                    featured ? 'border-warning bg-warning/10 text-warning' : 'border-[var(--ap-input-border)] text-muted-foreground',
                                )}
                            >
                                <Star className="h-3.5 w-3.5" fill={featured ? 'currentColor' : 'none'} />Featured only
                            </button>
                            {isFiltered && <Button type="button" variant="outline" className="h-[42px]" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear</Button>}
                        </div>
                    </div>
                </FilterPanel>

                {/* Bulk action bar */}
                <AnimatePresence>
                    {selected.size > 0 && can.manage_menu_items && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary px-4 py-3">
                            <span className="text-sm font-semibold text-primary-foreground">{selected.size} selected</span>
                            <div className="flex-1" />
                            <button onClick={() => {
 setBulkOpen((v) => !v); setBulkValue(''); 
}} className="flex items-center gap-1.5 rounded-xl bg-primary-foreground px-3.5 py-1.5 text-sm font-medium text-primary">
                                <TrendingUp className="h-3.5 w-3.5" />
                                Bulk Price Update
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', bulkOpen && 'rotate-180')} />
                            </button>
                            <button onClick={() => setSelected(new Set())} className="rounded-xl border border-primary-foreground/30 px-3 py-1.5 text-sm text-primary-foreground/80">Deselect</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bulk price panel */}
                <AnimatePresence>
                    {bulkOpen && selected.size > 0 && can.manage_menu_items && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-2xl border border-border bg-card">
                            <div className="p-4">
                                <p className="mb-3 text-sm font-semibold text-foreground">Bulk Price Update — {selected.size} item{selected.size !== 1 ? 's' : ''}</p>
                                <div className="flex flex-wrap items-end gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Adjustment type</label>
                                        <div className="flex overflow-hidden rounded-xl border border-border">
                                            {((['percent_increase', 'percent_decrease', 'fixed_increase', 'fixed_decrease'] as BulkType[]).concat(hasSelectedWithVariations ? ['per_variation' as BulkType] : [])).map((t, i, arr) => (
                                                <button
                                                    key={t}
                                                    onClick={() => setBulkType(t)}
                                                    className={cn(
                                                        'px-3 py-2 text-xs font-medium transition-all',
                                                        bulkType === t ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
                                                        i < arr.length - 1 && 'border-r border-border',
                                                    )}
                                                >
                                                    {bulkTypeLabel[t]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {bulkType !== 'per_variation' && hasSelectedWithVariations && (
                                        <div>
                                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Apply to sizes</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkSizes([])}
                                                    className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-all', activeBulkSizes.length === 0 ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground')}
                                                >
                                                    All sizes
                                                </button>
                                                {selectedVariationNames.map((name) => {
                                                    const on = activeBulkSizes.includes(name);

                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            aria-pressed={on}
                                                            onClick={() => setBulkSizes(on ? activeBulkSizes.filter((n) => n !== name) : [...activeBulkSizes, name])}
                                                            className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-all', on ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground')}
                                                        >
                                                            {name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {bulkType === 'per_variation' ? (
                                        <div>
                                            <label className="mb-2 block text-xs font-medium text-muted-foreground">Set price per size</label>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedVariationNames.map((name) => (
                                                    <div key={name} className="flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2">
                                                        <span className="w-16 truncate text-xs font-semibold text-foreground">{name}</span>
                                                        <span className="text-xs text-muted-foreground">₱</span>
                                                        <input
                                                            type="number" min="0" step="0.01"
                                                            value={bulkVariationPrices[name] ?? ''}
                                                            onChange={(e) => setBulkVariationPrices((prev) => ({ ...prev, [name]: e.target.value }))}
                                                            placeholder="0.00"
                                                            className="w-20 rounded-lg border border-border bg-card px-2 py-1 text-sm focus:ring-3 focus:ring-primary/10 focus:outline-none"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground">Leave blank to skip that size. Items without that size name are unaffected.</p>
                                        </div>
                                    ) : (
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                            {bulkType === 'fixed_increase' || bulkType === 'fixed_decrease' ? 'Amount (₱)' : 'Percentage (%)'}
                                        </label>
                                        <div className="relative">
                                            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                                {bulkType === 'fixed_increase' || bulkType === 'fixed_decrease' ? '₱' : <Percent className="h-3.5 w-3.5" />}
                                            </span>
                                            <input type="number" min="0" step="0.01" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="0.00" className={adminFieldClass() + ' w-36 pl-7'} />
                                        </div>
                                    </div>
                                    )}
                                    {bulkType !== 'per_variation' && bulkValue && Number(bulkValue) > 0 && (
                                        <p className="pb-2 text-xs text-muted-foreground">
                                            {bulkType === 'percent_increase' && `Each price increases by ${bulkValue}%`}
                                            {bulkType === 'percent_decrease' && `Each price decreases by ${bulkValue}%`}
                                            {bulkType === 'fixed_increase' && `₱${Number(bulkValue).toFixed(2)} added to each price (per size)`}
                                            {bulkType === 'fixed_decrease' && `₱${Number(bulkValue).toFixed(2)} subtracted from each price (per size)`}
                                        </p>
                                    )}
                                    {bulkPreview.length > 0 && (
                                        <div className="w-full basis-full">
                                            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preview ({bulkPreview.length} price{bulkPreview.length !== 1 ? 's' : ''} will change)</p>
                                            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-xl border border-border text-xs">
                                                {bulkPreview.map((row) => (
                                                    <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
                                                        <span className="truncate text-foreground">{row.label}</span>
                                                        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                                                            ₱{row.from.toFixed(2)} → <span className="font-semibold text-primary">₱{row.to.toFixed(2)}</span>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <Button onClick={applyBulkPrice} disabled={bulkProcessing || (bulkType !== 'per_variation' && !bulkValue)}>
                                        {bulkProcessing ? 'Applying...' : 'Apply'}
                                    </Button>
                                    <Button variant="outline" onClick={() => {
 setBulkOpen(false); setBulkValue(''); 
}}>Cancel</Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Table */}
                <TableCard>
                    <TableScroll>
                        <Table className="min-w-[820px]">
                            <TableHead>
                                <tr>
                                    {can.manage_menu_items && (
                                        <TableHeadCell className="w-10">
                                            <button onClick={toggleSelectAll} className="flex items-center justify-center">
                                                {allSelected ? (
                                                    <CheckSquare className="h-4 w-4 text-primary" />
                                                ) : someSelected ? (
                                                    <div className="flex h-4 w-4 items-center justify-center rounded border-[1.5px] border-primary bg-primary/20">
                                                        <div className="h-2 w-2 rounded-sm bg-primary" />
                                                    </div>
                                                ) : (
                                                    <Square className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </button>
                                        </TableHeadCell>
                                    )}
                                    {['Item', 'Category', 'Price', 'Add-ons', 'Availability', ''].map((h) => (
                                        <TableHeadCell key={h}>{h}</TableHeadCell>
                                    ))}
                                </tr>
                            </TableHead>
                            <TableBody>
                                {localItems.length === 0 ? (
                                    <TableEmpty colSpan={can.manage_menu_items ? 7 : 6}>
                                        <div className="flex flex-col items-center gap-2">
                                            <Tag className="h-10 w-10 text-muted-foreground opacity-30" />
                                            <p>{isFiltered ? 'No items match your filters.' : 'No menu items yet.'}</p>
                                            {can.manage_menu_items && !isFiltered && <button onClick={openCreate} className="mt-1 text-sm font-medium text-primary hover:underline">Add your first item</button>}
                                        </div>
                                    </TableEmpty>
                                ) : localItems.map((item) => (
                                    <TableRow key={item.id} className={selected.has(item.id) ? 'bg-primary/5' : undefined}>
                                        {can.manage_menu_items && (
                                            <TableCell className="w-10">
                                                <button onClick={() => toggleSelect(item.id)}>
                                                    {selected.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                                                </button>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex min-w-[210px] items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
                                                    {item.image_url ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" /> : '☕'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground">{item.name}</p>
                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                        {!item.is_kitchen && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Made by the barista (not sent to the kitchen)">Barista</span>}
                                                        {item.is_featured && <span className="flex items-center gap-0.5 text-xs text-warning"><Star className="h-2.5 w-2.5" fill="currentColor" /> Featured</span>}
                                                        {item.has_variations && <span className="text-xs text-muted-foreground">· {item.variations?.length} sizes</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{item.category?.name ?? '—'}</TableCell>
                                        <TableCell className="font-bold whitespace-nowrap text-primary">
                                            {item.has_variations && item.variations && item.variations.length > 1
                                                ? `₱${Math.min(...item.variations.map((v) => Number(v.price))).toFixed(2)} – ₱${Math.max(...item.variations.map((v) => Number(v.price))).toFixed(2)}`
                                                : `₱${Number(item.display_price ?? item.price).toFixed(2)}`}
                                        </TableCell>
                                        <TableCell>
                                            {item.addon_groups && item.addon_groups.length > 0 ? (
                                                <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs whitespace-nowrap text-info">{item.addon_groups.length} group{item.addon_groups.length !== 1 ? 's' : ''}</span>
                                            ) : <span className="text-xs text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            {can.manage_menu_items ? (
                                                <button
                                                    onClick={() => handleToggleAvailability(item)}
                                                    className={cn(
                                                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                                                        item.is_available ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error',
                                                    )}
                                                >
                                                    <span className={cn('h-1.5 w-1.5 rounded-full', item.is_available ? 'bg-success' : 'bg-error')} />
                                                    {item.is_available ? 'Available' : 'Unavailable'}
                                                </button>
                                            ) : (
                                                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', item.is_available ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                                                    {item.is_available ? 'Available' : 'Unavailable'}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {can.manage_menu_items && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                                                    <button onClick={() => setDeleting(item)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableScroll>
                </TableCard>
            </div>

            {can.import_menu_items && <MenuImportDialog open={importOpen} onOpenChange={setImportOpen} />}

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title={deleting ? `Delete "${deleting.name}"?` : 'Delete item?'}
                confirmLabel="Delete"
            />

            {/* Create / Edit Modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Item' : 'New Menu Item'}
                footer={
                    <Button type="submit" form="menu-item-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Item'}
                    </Button>
                }
            >
                <form id="menu-item-form" onSubmit={submit} className="space-y-4" encType="multipart/form-data">
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Category" required error={errors.category_id}>
                            <select value={data.category_id} onChange={(e) => setData('category_id', e.target.value)} className={adminFieldClass()}>
                                <option value="">Select...</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </FormField>
                        {!usesVariations && (
                            <FormField label="Price (₱)" required error={errors.price}>
                                <input type="number" step="0.01" value={data.price} onChange={(e) => setData('price', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                        )}
                    </div>
                    <FormField label="Name" required error={errors.name}>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className={adminFieldClass()} />
                    </FormField>
                    <FormField label="Description">
                        <textarea value={data.description} onChange={(e) => setData('description', e.target.value)} className={adminFieldClass()} rows={3} />
                    </FormField>
                    <FormField label="Image" error={errors.image}>
                        <div className="flex items-start gap-3">
                            <div
                                className={cn(
                                    'relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted transition-colors hover:border-primary',
                                    imagePreview ? 'border-transparent' : 'border-border',
                                )}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100"><ImagePlus className="h-5 w-5 text-white" /></div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-center">
                                        <ImagePlus className="h-6 w-6 text-primary" />
                                        <span className="text-[10px] text-muted-foreground">Upload</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground">Click the box to {imagePreview ? 'change' : 'upload'} an image.<br />JPG, PNG or WEBP · Max 2MB</p>
                                {imagePreview && <button type="button" onClick={() => {
 onFileChange(null);

 if (fileInputRef.current) {
fileInputRef.current.value = '';
} 
}} className="mt-2 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10"><X className="h-3 w-3" /> Remove image</button>}
                            </div>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
                    </FormField>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                            <input type="checkbox" checked={data.is_available} onChange={(e) => setData('is_available', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />Available
                        </label>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                            <input type="checkbox" checked={data.is_featured} onChange={(e) => setData('is_featured', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />Featured
                        </label>
                        <label className="flex items-center gap-2 text-sm text-foreground" title="On: cooked in the kitchen and shown on the Kitchen screen. Off: made by the barista and shown on the Barista screen.">
                            <input type="checkbox" checked={data.is_kitchen} onChange={(e) => setData('is_kitchen', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />Kitchen item (off = Barista)
                        </label>
                    </div>
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Size Variations</span>
                            <button type="button" onClick={addVariation} className="text-xs font-medium text-primary hover:underline">+ Add size</button>
                        </div>
                        {usesVariations ? (
                            <div className="space-y-2">
                                <div className="flex gap-2 px-0.5 text-xs font-medium text-muted-foreground">
                                    <span className="min-w-0 flex-1">Size name</span>
                                    <span className="w-28 shrink-0">Price ({currency})</span>
                                    <span className="w-9 shrink-0" />
                                </div>
                                {data.variations.map((variation, index) => {
                                    const nameError = (errors as Record<string, string>)[`variations.${index}.name`];
                                    const priceError = (errors as Record<string, string>)[`variations.${index}.price`];

                                    return (
                                    <div key={index}>
                                    <div className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1">
                                            <input value={variation.name} onChange={(e) => updateVariation(index, 'name', e.target.value)} placeholder="e.g., Medium" aria-label={`Size ${index + 1} name`} className={adminFieldClass(!!nameError)} />
                                        </div>
                                        <div className="w-28 shrink-0">
                                            <input type="number" min="0" step="0.01" inputMode="decimal" value={variation.price} onChange={(e) => updateVariation(index, 'price', e.target.value)} placeholder="0.00" aria-label={`Size ${index + 1} price`} className={adminFieldClass(!!priceError)} />
                                        </div>
                                        <button type="button" onClick={() => removeVariation(index)} aria-label={`Remove size ${index + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><X className="h-4 w-4" /></button>
                                    </div>
                                    {(nameError || priceError) && <p className="mt-1 text-xs text-error">{nameError ?? priceError}</p>}
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">Add sizes with their own prices, or leave empty to use a single price above.</p>
                        )}
                    </div>
                    <FormField label="Add-on Groups">
                        <div className="flex flex-wrap gap-2">
                            {addon_groups.filter((g) => !usesVariations || g.name.toLowerCase() !== 'size').map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleAddonGroup(g.id)}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                                        data.addon_group_ids.includes(g.id) ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground',
                                    )}
                                >
                                    {g.name} {g.is_required ? '*' : ''}
                                </button>
                            ))}
                        </div>
                    </FormField>
                </form>
            </CrudModal>
        </AdminLayout>
    );
}
