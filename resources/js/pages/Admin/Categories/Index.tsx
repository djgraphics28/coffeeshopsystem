import { Head, useForm, usePage } from '@inertiajs/react';
import { adminCategoriesDestroy, adminCategoriesStore, adminCategoriesUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Category {
    id: number;
    name: string;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
    menu_items_count: number;
}

interface Props {
    categories: Category[];
}

export default function CategoriesIndex({ categories }: Props) {
    const { flash } = usePage().props as { flash: { success?: string; error?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        icon: '',
        sort_order: 0,
        is_active: true as boolean,
    });

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(cat: Category) {
        setEditing(cat);
        setData({ name: cat.name, icon: cat.icon ?? '', sort_order: cat.sort_order, is_active: cat.is_active });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (editing) {
            put(adminCategoriesUpdate(editing.id), { onSuccess: () => { setModalOpen(false); toast.success('Category updated!'); } });
        } else {
            post(adminCategoriesStore(), { onSuccess: () => { setModalOpen(false); toast.success('Category created!'); } });
        }
    }

    return (
        <AdminLayout>
            <Head title="Categories — Admin" />
            <Toaster position="top-right" />

            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Categories</h1>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Category
                    </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ background: 'var(--ap-bg)' }}>
                                    {cat.icon ?? '📁'}
                                </div>
                                <div>
                                    <p className="font-semibold" style={{ color: 'var(--ap-input-text)' }}>{cat.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{cat.menu_items_count} items · order #{cat.sort_order}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {cat.is_active ? 'Active' : 'Hidden'}
                                </span>
                                <button onClick={() => openEdit(cat)} className="rounded-lg p-1.5 hover:bg-gray-100">
                                    <Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                </button>
                                <button
                                    onClick={() => { if (confirm('Delete this category?')) { fetch(adminCategoriesDestroy(cat.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' } }).then(() => window.location.reload()); } }}
                                    className="rounded-lg p-1.5 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60 }}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {editing ? 'Edit Category' : 'New Category'}
                                </h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="e.g., Espresso Classics" />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Icon (emoji)</label>
                                    <input value={data.icon} onChange={(e) => setData('icon', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="☕" maxLength={10} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Sort Order</label>
                                        <input type="number" value={data.sort_order} onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col justify-end pb-0.5">
                                        <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>
                                            <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="h-4 w-4 rounded" />
                                            Active
                                        </label>
                                    </div>
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
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
