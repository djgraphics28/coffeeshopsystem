import { Head, useForm, router } from '@inertiajs/react';
import { adminDeliveryMenAccount, adminDeliveryMenDestroy, adminDeliveryMenStore, adminDeliveryMenUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Bike, Edit2, KeyRound, Phone, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface DeliveryMan {
    id: number;
    name: string;
    phone: string | null;
    vehicle: string | null;
    is_active: boolean;
    user: { id: number; email: string } | null;
    active_deliveries_count: number;
    total_deliveries_count: number;
}

interface Props {
    delivery_men: DeliveryMan[];
}

export default function DeliveryMenIndex({ delivery_men }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<DeliveryMan | null>(null);
    const [deleting, setDeleting] = useState<DeliveryMan | null>(null);
    const [accountFor, setAccountFor] = useState<DeliveryMan | null>(null);
    const [accountEmail, setAccountEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [savingAccount, setSavingAccount] = useState(false);
    const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});

    function openAccount(man: DeliveryMan) {
        setAccountFor(man);
        setAccountEmail(man.user?.email ?? '');
        setAccountPassword('');
        setAccountErrors({});
    }

    function saveAccount(e: React.FormEvent) {
        e.preventDefault();
        if (!accountFor) return;
        setSavingAccount(true);
        router.put(adminDeliveryMenAccount(accountFor.id), { email: accountEmail, password: accountPassword }, {
            preserveScroll: true,
            onSuccess: () => { setAccountFor(null); toast.success('Driver account saved!'); },
            onError: (errs) => setAccountErrors(errs as Record<string, string>),
            onFinish: () => setSavingAccount(false),
        });
    }

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        phone: '',
        vehicle: '',
        is_active: true as boolean,
    });

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(man: DeliveryMan) {
        setEditing(man);
        setData({ name: man.name, phone: man.phone ?? '', vehicle: man.vehicle ?? '', is_active: man.is_active });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (editing) {
            put(adminDeliveryMenUpdate(editing.id), { onSuccess: () => { setModalOpen(false); toast.success('Delivery man updated!'); } });
        } else {
            post(adminDeliveryMenStore(), { onSuccess: () => { setModalOpen(false); toast.success('Delivery man added!'); } });
        }
    }

    function confirmDelete() {
        if (!deleting) return;
        router.delete(adminDeliveryMenDestroy(deleting.id), {
            onSuccess: () => { setDeleting(null); toast.success('Delivery man removed.'); },
        });
    }

    return (
        <AdminLayout>
            <Head title="Delivery Men — Admin" />
            <Toaster position="top-right" />

            <div className="p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Delivery Men</h1>
                        <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>Manage riders and assign them to delivery orders.</p>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Delivery Man
                    </button>
                </div>

                {delivery_men.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl bg-white py-16 shadow-sm" style={{ border: '1px solid var(--ap-border)', color: 'var(--ap-muted)' }}>
                        <Bike className="mb-3 h-12 w-12 opacity-30" />
                        <p className="text-sm">No delivery men yet — add your first rider.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {delivery_men.map((man) => (
                            <div key={man.id} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: '#D4A843' }}>
                                            {man.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--ap-input-text)' }}>{man.name}</p>
                                            <span className={`rounded-full px-2 py-0.5 text-xs ${man.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {man.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openEdit(man)} className="rounded-lg p-1.5 hover:bg-gray-100"><Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} /></button>
                                        <button onClick={() => setDeleting(man)} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                    {man.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {man.phone}</p>}
                                    {man.vehicle && <p className="flex items-center gap-1.5"><Bike className="h-3 w-3" /> {man.vehicle}</p>}
                                </div>

                                <button
                                    onClick={() => openAccount(man)}
                                    className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-black/5"
                                    style={{ background: 'var(--ap-bg)' }}
                                >
                                    <KeyRound className="h-3.5 w-3.5 shrink-0" style={{ color: man.user ? '#16A34A' : '#D4A843' }} />
                                    {man.user ? (
                                        <span className="truncate" style={{ color: 'var(--ap-input-text)' }}>
                                            <span className="font-semibold text-green-600">Driver app login</span> · {man.user.email}
                                        </span>
                                    ) : (
                                        <span className="font-semibold" style={{ color: '#D4A843' }}>Create driver app login</span>
                                    )}
                                </button>

                                <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--ap-border)' }}>
                                    <div className="flex-1 rounded-xl px-2 py-1.5 text-center" style={{ background: 'var(--ap-bg)' }}>
                                        <p className="text-sm font-bold" style={{ color: man.active_deliveries_count > 0 ? '#D97706' : 'var(--ap-input-text)' }}>{man.active_deliveries_count}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--ap-muted)' }}>On delivery</p>
                                    </div>
                                    <div className="flex-1 rounded-xl px-2 py-1.5 text-center" style={{ background: 'var(--ap-bg)' }}>
                                        <p className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>{man.total_deliveries_count}</p>
                                        <p className="text-[10px]" style={{ color: 'var(--ap-muted)' }}>Total</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Form Modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60 }}>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{editing ? 'Edit Delivery Man' : 'New Delivery Man'}</h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="e.g., Juan Dela Cruz" />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Phone</label>
                                    <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="09171234567" />
                                    {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Vehicle</label>
                                        <input value={data.vehicle} onChange={(e) => setData('vehicle', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="Motorcycle" />
                                    </div>
                                    <div className="flex flex-col justify-end pb-2">
                                        <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>
                                            <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} />
                                            Active
                                        </label>
                                    </div>
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Add Delivery Man'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Delete confirmation */}
            <AnimatePresence>
                {deleting && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setDeleting(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 text-center shadow-xl" style={{ zIndex: 60 }}>
                            <Trash2 className="mx-auto h-10 w-10 text-red-400" />
                            <h2 className="mt-3 text-lg font-bold" style={{ color: 'var(--ap-input-text)' }}>Remove {deleting.name}?</h2>
                            <p className="mt-1 text-sm" style={{ color: 'var(--ap-muted)' }}>Past orders keep their records; the rider will simply be unassigned.</p>
                            <div className="mt-5 flex gap-2">
                                <button onClick={() => setDeleting(null)} className="flex-1 rounded-full border py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}>Cancel</button>
                                <button onClick={confirmDelete} className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-bold text-white">Remove</button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            {/* Driver account modal */}
            <AnimatePresence>
                {accountFor && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setAccountFor(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60 }}>
                            <div className="mb-1 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {accountFor.user ? 'Driver Account' : 'Create Driver Account'}
                                </h2>
                                <button onClick={() => setAccountFor(null)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <p className="mb-4 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                {accountFor.name} signs in at <span className="font-mono font-semibold">/login</span> and lands on the driver app.
                            </p>
                            <form onSubmit={saveAccount} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Email *</label>
                                    <input
                                        type="email"
                                        value={accountEmail}
                                        onChange={(e) => setAccountEmail(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                        placeholder="rider@example.com"
                                    />
                                    {accountErrors.email && <p className="mt-1 text-xs text-red-500">{accountErrors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>
                                        {accountFor.user ? 'New Password (leave blank to keep current)' : 'Password *'}
                                    </label>
                                    <input
                                        type="password"
                                        value={accountPassword}
                                        onChange={(e) => setAccountPassword(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                        placeholder="Min. 8 characters"
                                    />
                                    {accountErrors.password && <p className="mt-1 text-xs text-red-500">{accountErrors.password}</p>}
                                </div>
                                <button type="submit" disabled={savingAccount} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {savingAccount ? 'Saving...' : accountFor.user ? 'Update Account' : 'Create Account'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
