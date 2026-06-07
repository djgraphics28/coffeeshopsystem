import { Head, useForm } from '@inertiajs/react';
import { adminAddonGroupsDestroy, adminAddonGroupsStore, adminAddonGroupsUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Addon { id?: number; name: string; additional_price: number; sort_order: number }
interface AddonGroup { id: number; name: string; is_required: boolean; max_selections: number; sort_order: number; addons: Addon[] }
interface Props { groups: AddonGroup[] }

export default function AddonGroupsIndex({ groups }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AddonGroup | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm<{
        name: string; is_required: boolean; max_selections: number; sort_order: number;
        addons: Addon[]; _method?: string;
    }>({ name: '', is_required: false, max_selections: 1, sort_order: 0, addons: [{ name: '', additional_price: 0, sort_order: 1 }] });

    function openCreate() { reset(); setData('addons', [{ name: '', additional_price: 0, sort_order: 1 }]); setEditing(null); setModalOpen(true); }
    function openEdit(g: AddonGroup) {
        setEditing(g);
        setData({ name: g.name, is_required: g.is_required, max_selections: g.max_selections, sort_order: g.sort_order, addons: g.addons, _method: 'PUT' });
        setModalOpen(true);
    }

    function addAddon() { setData('addons', [...data.addons, { name: '', additional_price: 0, sort_order: data.addons.length + 1 }]); }
    function removeAddon(i: number) { setData('addons', data.addons.filter((_, idx) => idx !== i)); }
    function updateAddon(i: number, field: keyof Addon, value: string | number) {
        const updated = [...data.addons];
        (updated[i] as Record<string, unknown>)[field] = value;
        setData('addons', updated);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminAddonGroupsUpdate(editing.id) : adminAddonGroupsStore();
        post(url, { onSuccess: () => { setModalOpen(false); toast.success(editing ? 'Updated!' : 'Created!'); } });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    return (
        <AdminLayout>
            <Head title="Add-on Groups — Admin" />
            <Toaster position="top-right" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Add-on Groups</h1>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Group
                    </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) => (
                        <div key={group.id} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold" style={{ color: 'var(--ap-input-text)' }}>{group.name}</p>
                                    <div className="mt-1 flex gap-2">
                                        {group.is_required && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">Required</span>}
                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                            max {group.max_selections} sel.
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(group)} className="rounded-lg p-1.5 hover:bg-gray-100"><Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                                    <button onClick={() => { if (confirm('Delete group?')) { fetch(adminAddonGroupsDestroy(group.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload()); } }} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-400" /></button>
                                </div>
                            </div>
                            <div className="mt-3 space-y-1">
                                {group.addons.map((addon) => (
                                    <div key={addon.id} className="flex justify-between text-sm">
                                        <span style={{ color: 'var(--ap-muted)' }}>{addon.name}</span>
                                        <span style={{ color: Number(addon.additional_price) > 0 ? '#D4A843' : '#9CA3AF' }}>
                                            {Number(addon.additional_price) > 0 ? `+₱${addon.additional_price}` : Number(addon.additional_price) < 0 ? `-₱${Math.abs(Number(addon.additional_price))}` : 'Free'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60, maxHeight: '90vh' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{editing ? 'Edit Group' : 'New Add-on Group'}</h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Group Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="e.g., Size" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Max Selections</label>
                                        <input type="number" min={1} value={data.max_selections} onChange={(e) => setData('max_selections', parseInt(e.target.value) || 1)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col justify-end pb-1">
                                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ap-input-text)' }}>
                                            <input type="checkbox" checked={data.is_required} onChange={(e) => setData('is_required', e.target.checked)} />
                                            Required
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Options</label>
                                        <button type="button" onClick={addAddon} className="text-xs font-medium" style={{ color: '#D4A843' }}>+ Add option</button>
                                    </div>
                                    <div className="space-y-2">
                                        {data.addons.map((addon, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input value={addon.name} onChange={(e) => updateAddon(i, 'name', e.target.value)} placeholder="Option name" className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                                <input type="number" step="0.01" value={addon.additional_price} onChange={(e) => updateAddon(i, 'additional_price', parseFloat(e.target.value) || 0)} placeholder="+price" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                                {data.addons.length > 1 && (
                                                    <button type="button" onClick={() => removeAddon(i)}><X className="h-4 w-4 text-red-400" /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Group'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
