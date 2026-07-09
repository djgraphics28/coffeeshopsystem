import { Head, useForm, usePage } from '@inertiajs/react';
import { adminExpenseCategoriesDestroy, adminExpenseCategoriesStore, adminExpenseCategoriesUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface ExpenseCategory {
    id: number;
    name: string;
    description: string | null;
    color: string;
    is_active: boolean;
    expenses_count: number;
}

interface Props {
    categories: ExpenseCategory[];
}

const PRESET_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6',
    '#8B5CF6', '#EC4899', '#6B7280', '#2C1A0E', '#D4A843',
];

export default function ExpenseCategoriesIndex({ categories }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<ExpenseCategory | null>(null);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string; description: string; color: string; is_active: boolean; _method?: string;
    }>({ name: '', description: '', color: '#6B7280', is_active: true });

    function openCreate() { reset(); setEditing(null); setModalOpen(true); }
    function openEdit(cat: ExpenseCategory) {
        setEditing(cat);
        setData({ name: cat.name, description: cat.description ?? '', color: cat.color, is_active: cat.is_active, _method: 'PUT' });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminExpenseCategoriesUpdate(editing.id) : adminExpenseCategoriesStore();
        post(url, { onSuccess: () => { setModalOpen(false); } });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    return (
        <AdminLayout>
            <Head title="Expense Categories — Admin" />
            <Toaster position="top-right" />
            <div className="p-6 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Expense Categories
                        </h1>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {categories.length} categories
                        </p>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Category
                    </button>
                </div>

                {/* Grid */}
                {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ border: '2px dashed var(--ap-border)' }}>
                        <FolderOpen className="h-12 w-12 mb-3 opacity-20" style={{ color: 'var(--ap-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>No expense categories yet.</p>
                        <button onClick={openCreate} className="mt-3 text-sm font-semibold" style={{ color: '#D4A843' }}>Create your first one →</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {categories.map((cat) => (
                            <motion.div
                                key={cat.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-2xl p-4 shadow-sm"
                                style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-lg" style={{ background: cat.color }}>
                                        {cat.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openEdit(cat)} className="rounded-lg p-1.5 hover:bg-black/5">
                                            <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (cat.expenses_count > 0) { toast.error('Cannot delete — has expenses'); return; }
                                                if (confirm(`Delete "${cat.name}"?`)) {
                                                    fetch(adminExpenseCategoriesDestroy(cat.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } })
                                                        .then(() => window.location.reload());
                                                }
                                            }}
                                            className="rounded-lg p-1.5 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                                <p className="font-semibold text-sm" style={{ color: 'var(--ap-input-text)' }}>{cat.name}</p>
                                {cat.description && <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--ap-muted)' }}>{cat.description}</p>}
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {cat.expenses_count} expense{cat.expenses_count !== 1 ? 's' : ''}
                                    </span>
                                    <span
                                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                                        style={cat.is_active
                                            ? { background: '#D1FAE5', color: '#065F46' }
                                            : { background: '#F3F4F6', color: '#6B7280' }}
                                    >
                                        {cat.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ zIndex: 60, background: 'var(--ap-card)' }}
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {editing ? 'Edit Category' : 'New Category'}
                                </h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Name *</label>
                                    <input
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="e.g. Supplies, Utilities..."
                                        className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Description</label>
                                    <input
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        placeholder="Optional description"
                                        className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-2" style={{ color: 'var(--ap-input-text)' }}>Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {PRESET_COLORS.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setData('color', c)}
                                                className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                                                style={{
                                                    background: c,
                                                    outline: data.color === c ? `3px solid ${c}` : 'none',
                                                    outlineOffset: '2px',
                                                }}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={data.color}
                                            onChange={(e) => setData('color', e.target.value)}
                                            className="h-7 w-7 cursor-pointer rounded-full border-0 p-0.5"
                                            title="Custom color"
                                        />
                                    </div>
                                    {errors.color && <p className="mt-1 text-xs text-red-500">{errors.color}</p>}
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.is_active}
                                        onChange={(e) => setData('is_active', e.target.checked)}
                                        className="rounded"
                                    />
                                    <span className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Active</span>
                                </label>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50"
                                    style={{ background: '#D4A843', color: '#2C1A0E' }}
                                >
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
