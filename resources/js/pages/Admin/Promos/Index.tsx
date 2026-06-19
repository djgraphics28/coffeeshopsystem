import { Head, useForm } from '@inertiajs/react';
import { adminPromosDestroy, adminPromosStore, adminPromosUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Promo {
    id: number;
    code: string;
    name: string;
    description: string | null;
    type: 'percentage' | 'fixed';
    value: number;
    min_order_amount: number;
    max_uses: number | null;
    uses_count: number;
    per_customer_limit: number | null;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

interface Props { promos: Promo[] }

export default function PromosIndex({ promos }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Promo | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm<{
        code: string; name: string; description: string; type: 'percentage' | 'fixed';
        value: string; min_order_amount: string; max_uses: string; per_customer_limit: string;
        expires_at: string; is_active: boolean; _method?: string;
    }>({
        code: '', name: '', description: '', type: 'percentage',
        value: '', min_order_amount: '0', max_uses: '', per_customer_limit: '',
        expires_at: '', is_active: true,
    });

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(promo: Promo) {
        setEditing(promo);
        setData({
            code: promo.code,
            name: promo.name,
            description: promo.description ?? '',
            type: promo.type,
            value: String(promo.value),
            min_order_amount: String(promo.min_order_amount),
            max_uses: promo.max_uses != null ? String(promo.max_uses) : '',
            per_customer_limit: promo.per_customer_limit != null ? String(promo.per_customer_limit) : '',
            expires_at: promo.expires_at ? promo.expires_at.slice(0, 16) : '',
            is_active: promo.is_active,
            _method: 'PUT',
        });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminPromosUpdate(editing.id) : adminPromosStore();
        post(url, { onSuccess: () => { setModalOpen(false); toast.success(editing ? 'Promo updated!' : 'Promo created!'); } });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    function formatExpiry(iso: string | null) {
        if (!iso) return <span className="text-gray-300">—</span>;
        const d = new Date(iso);
        return d < new Date() ? <span className="text-red-400 text-xs">Expired</span> : <span className="text-xs">{d.toLocaleDateString()}</span>;
    }

    return (
        <AdminLayout>
            <Head title="Promos — Admin" />
            <Toaster position="top-right" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Promo Codes</h1>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>{promos.length} promo{promos.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Promo
                    </button>
                </div>

                <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>
                                {['Code', 'Name', 'Discount', 'Min Order', 'Uses', 'Expires', 'Status', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {promos.length === 0 && (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>No promos yet.</td></tr>
                            )}
                            {promos.map((promo) => (
                                <tr key={promo.id} className="border-t transition-colors" style={{ borderColor: 'var(--ap-border)' }}>
                                    <td className="px-4 py-3">
                                        <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold" style={{ color: '#2C1A0E' }}>{promo.code}</code>
                                    </td>
                                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ap-input-text)' }}>{promo.name}</td>
                                    <td className="px-4 py-3 font-semibold" style={{ color: '#D4A843' }}>
                                        {promo.type === 'percentage' ? `${promo.value}%` : `₱${promo.value}`}
                                    </td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {promo.min_order_amount > 0 ? `₱${promo.min_order_amount}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {promo.uses_count}{promo.max_uses ? `/${promo.max_uses}` : ''}
                                    </td>
                                    <td className="px-4 py-3">{formatExpiry(promo.expires_at)}</td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={promo.is_active ? { background: '#D1FAE5', color: '#065F46' } : { background: '#F3F4F6', color: '#6B7280' }}>
                                            {promo.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(promo)} className="rounded-lg p-1.5 hover:bg-gray-100"><Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                                            <button
                                                onClick={() => { if (confirm(`Delete promo ${promo.code}?`)) { fetch(adminPromosDestroy(promo.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload()); } }}
                                                className="rounded-lg p-1.5 hover:bg-red-50"
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
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
                            style={{ zIndex: 60, maxHeight: '90vh' }}
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {editing ? 'Edit Promo' : 'New Promo'}
                                </h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Code *</label>
                                        <input value={data.code} onChange={(e) => setData('code', e.target.value.toUpperCase())} placeholder="SUMMER20" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-yellow-400 focus:outline-none" />
                                        {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code}</p>}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Name *</label>
                                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Summer Sale" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Description</label>
                                    <input value={data.description} onChange={(e) => setData('description', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Type *</label>
                                        <select value={data.type} onChange={(e) => setData('type', e.target.value as 'percentage' | 'fixed')} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none">
                                            <option value="percentage">Percentage (%)</option>
                                            <option value="fixed">Fixed Amount (₱)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Value *</label>
                                        <input type="number" min="0" step="0.01" value={data.value} onChange={(e) => setData('value', e.target.value)} placeholder={data.type === 'percentage' ? '20' : '50'} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                        {errors.value && <p className="mt-1 text-xs text-red-500">{errors.value}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Min Order (₱)</label>
                                        <input type="number" min="0" step="0.01" value={data.min_order_amount} onChange={(e) => setData('min_order_amount', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Max Total Uses</label>
                                        <input type="number" min="1" value={data.max_uses} onChange={(e) => setData('max_uses', e.target.value)} placeholder="Unlimited" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Per Customer Limit</label>
                                        <input type="number" min="1" value={data.per_customer_limit} onChange={(e) => setData('per_customer_limit', e.target.value)} placeholder="Unlimited" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Expires At</label>
                                        <input type="datetime-local" value={data.expires_at} onChange={(e) => setData('expires_at', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                                    <span className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Active</span>
                                    <button
                                        type="button"
                                        onClick={() => setData('is_active', !data.is_active)}
                                        className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
                                        style={{ background: data.is_active ? '#D4A843' : '#E5E7EB' }}
                                    >
                                        <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: data.is_active ? 'translateX(20px)' : 'translateX(0)' }} />
                                    </button>
                                </div>

                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Promo'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
