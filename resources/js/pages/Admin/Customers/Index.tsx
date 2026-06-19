import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { adminCustomersDestroy, adminCustomersShow, adminCustomersStore, adminCustomersUpdate, adminCustomersVerifyEmail } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Coffee, Edit2, Gift, Plus, ShieldAlert, Star, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Customer {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    email_verified_at: string | null;
    notes: string | null;
    points: number;
    cup_count: number;
    free_drinks_available: number;
    orders_count: number;
    orders_sum_total: number | null;
    last_order_at: string | null;
    created_at: string;
}

interface Stats {
    total: number;
    total_points_outstanding: number;
    loyalty_members: number;
    free_drinks_available: number;
}

interface Props {
    customers: Customer[];
    stats: Stats;
}

export default function CustomersIndex({ customers, stats }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);

    useEffect(() => { if (flash?.success) toast.success(flash.success); }, [flash]);

    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string; phone: string; email: string; notes: string; _method?: string;
    }>({ name: '', phone: '', email: '', notes: '' });

    function openCreate() { reset(); setEditing(null); setModalOpen(true); }
    function openEdit(e: React.MouseEvent, customer: Customer) {
        e.preventDefault(); e.stopPropagation();
        setEditing(customer);
        setData({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '', notes: customer.notes ?? '', _method: 'PUT' });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminCustomersUpdate(editing.id) : adminCustomersStore();
        post(url, { onSuccess: () => { setModalOpen(false); toast.success(editing ? 'Customer updated!' : 'Customer created!'); } });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    function fmtDate(iso: string | null) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const statCards = [
        { label: 'Total Customers', value: stats.total, icon: Users, color: '#3B82F6', bg: '#EFF6FF' },
        { label: 'Points Outstanding', value: stats.total_points_outstanding.toLocaleString(), icon: Star, color: '#D97706', bg: '#FEF3C7' },
        { label: 'Loyalty Members', value: stats.loyalty_members, icon: Coffee, color: '#10B981', bg: '#D1FAE5' },
        { label: 'Free Drinks Available', value: stats.free_drinks_available, icon: Gift, color: '#EF4444', bg: '#FEF2F2' },
    ];

    return (
        <AdminLayout>
            <Head title="Customers — Admin" />
            <Toaster position="top-right" />
            <div className="p-6 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Customers</h1>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>{stats.total} registered customers</p>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add Customer
                    </button>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>{label}</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: bg }}>
                                    <Icon className="h-4 w-4" style={{ color }} />
                                </div>
                            </div>
                            <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--ap-input-text)' }}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>
                                {['Customer', 'Contact', 'Orders', 'Total Spent', 'Points', 'Cups', 'Free Drinks', 'Last Order', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {customers.length === 0 && (
                                <tr><td colSpan={9} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--ap-muted)' }}>No customers yet.</td></tr>
                            )}
                            {customers.map((customer) => (
                                <tr
                                    key={customer.id}
                                    className="group border-t transition-colors hover:bg-amber-50/40 cursor-pointer"
                                    style={{ borderColor: 'var(--ap-border)' }}
                                    onClick={() => window.location.href = adminCustomersShow(customer.id)}
                                >
                                    {/* Customer */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: '#2C1A0E' }}>
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-xs" style={{ color: 'var(--ap-input-text)' }}>{customer.name}</p>
                                                {customer.notes && <p className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--ap-muted)' }}>{customer.notes}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    {/* Contact */}
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{customer.email ?? '—'}</p>
                                            {customer.email && (
                                                customer.email_verified_at ? (
                                                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-500" title="Email verified" />
                                                ) : (
                                                    <button
                                                        onClick={() => { if (confirm(`Manually verify ${customer.name}'s email?`)) router.post(adminCustomersVerifyEmail(customer.id)); }}
                                                        title="Email not verified — click to verify"
                                                        className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium transition-colors hover:bg-amber-100"
                                                        style={{ color: '#D97706' }}
                                                    >
                                                        <ShieldAlert className="h-3 w-3" />
                                                        Verify
                                                    </button>
                                                )
                                            )}
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{customer.phone ?? ''}</p>
                                    </td>
                                    {/* Orders */}
                                    <td className="px-4 py-3">
                                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>
                                            {customer.orders_count}
                                        </span>
                                    </td>
                                    {/* Total spent */}
                                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--ap-input-text)' }}>
                                        {customer.orders_sum_total != null ? `₱${Number(customer.orders_sum_total).toFixed(2)}` : '—'}
                                    </td>
                                    {/* Points */}
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#D97706' }}>
                                            <Star className="h-3 w-3" />
                                            {customer.points.toLocaleString()}
                                        </span>
                                    </td>
                                    {/* Cups */}
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {customer.cup_count > 0
                                            ? <span className="font-medium" style={{ color: '#2C1A0E' }}>☕ {customer.cup_count}</span>
                                            : '—'
                                        }
                                    </td>
                                    {/* Free drinks */}
                                    <td className="px-4 py-3">
                                        {customer.free_drinks_available > 0
                                            ? <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: '#D1FAE5', color: '#065F46' }}>🎁 {customer.free_drinks_available}</span>
                                            : <span className="text-xs text-gray-300">—</span>
                                        }
                                    </td>
                                    {/* Last order */}
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {fmtDate(customer.last_order_at)}
                                    </td>
                                    {/* Actions */}
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => openEdit(e, customer)} className="rounded-lg p-1.5 hover:bg-gray-100">
                                                <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Delete ${customer.name}?`)) {
                                                        fetch(adminCustomersDestroy(customer.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } })
                                                            .then(() => window.location.reload());
                                                    }
                                                }}
                                                className="rounded-lg p-1.5 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"
                            style={{ zIndex: 60 }}
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {editing ? 'Edit Customer' : 'New Customer'}
                                </h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Full Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Phone</label>
                                    <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="e.g. 09171234567" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Email</label>
                                    <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Notes</label>
                                    <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} placeholder="Allergies, preferences..." className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
