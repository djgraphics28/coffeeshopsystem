import { Head, useForm } from '@inertiajs/react';
import { adminUsersDestroy, adminUsersStore, adminUsersUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface User { id: number; name: string; email: string; roles: string[]; created_at: string }
interface Role { id: number; name: string }
interface Props { users: User[]; roles: Role[] }

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin: { bg: '#FEF3C7', text: '#92400E' },
    cashier: { bg: '#DBEAFE', text: '#1E40AF' },
    kitchen: { bg: '#D1FAE5', text: '#065F46' },
};

export default function UsersIndex({ users, roles }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);

    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string; email: string; role: string; password: string; _method?: string;
    }>({ name: '', email: '', role: 'cashier', password: '' });

    function openCreate() { reset(); setEditing(null); setModalOpen(true); }
    function openEdit(user: User) {
        setEditing(user);
        setData({ name: user.name, email: user.email, role: user.roles[0] ?? 'cashier', password: '', _method: 'PUT' });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminUsersUpdate(editing.id) : adminUsersStore();
        post(url, { onSuccess: () => { setModalOpen(false); toast.success(editing ? 'User updated!' : 'User created!'); } });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    return (
        <AdminLayout>
            <Head title="Users — Admin" />
            <Toaster position="top-right" />
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Staff Users</h1>
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                        <Plus className="h-4 w-4" /> Add User
                    </button>
                </div>

                <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>{['Name', 'Email', 'Role', 'Joined', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-t transition-colors" style={{ borderColor: 'var(--ap-border)' }}>
                                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--ap-input-text)' }}>{user.name}</td>
                                    <td className="px-4 py-3" style={{ color: 'var(--ap-muted)' }}>{user.email}</td>
                                    <td className="px-4 py-3">
                                        {user.roles.map((role) => {
                                            const c = ROLE_COLORS[role] ?? { bg: '#F3F4F6', text: '#6B7280' };
                                            return <span key={role} className="rounded-full px-2 py-0.5 text-xs capitalize" style={c}>{role}</span>;
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(user)} className="rounded-lg p-1.5 hover:bg-gray-100"><Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} /></button>
                                            <button onClick={() => { if (confirm('Delete user?')) { fetch(adminUsersDestroy(user.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload()); } }} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-400" /></button>
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
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60 }}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{editing ? 'Edit User' : 'New User'}</h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Full Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Email *</label>
                                    <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Role *</label>
                                    <select value={data.role} onChange={(e) => setData('role', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none">
                                        {roles.map((r) => <option key={r.id} value={r.name} className="capitalize">{r.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                                    <input type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
