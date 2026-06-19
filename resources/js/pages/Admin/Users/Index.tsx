import { Head, router, useForm, usePage } from '@inertiajs/react';
import { adminUsersDestroy, adminUsersStore, adminUsersUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Edit2, Eye, EyeOff, Plus, Search, Shield, Trash2, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface User {
    id: number;
    name: string;
    email: string;
    roles: string[];
    created_at: string;
}

interface Role {
    id: number;
    name: string;
}

interface Props {
    users: User[];
    roles: Role[];
}

const ROLE_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
    admin:   { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    cashier: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
    kitchen: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
};

const AVATAR_COLORS = ['#7C3AED', '#0369A1', '#15803D', '#B45309', '#BE185D', '#0F766E', '#C2410C'];

function avatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
    return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function UsersIndex({ users, roles }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string;
        email: string;
        role: string;
        password: string;
        _method?: string;
    }>({ name: '', email: '', role: roles[0]?.name ?? '', password: '' });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const filtered = useMemo(() =>
        users.filter((u) => {
            const matchSearch =
                !search ||
                u.name.toLowerCase().includes(search.toLowerCase()) ||
                u.email.toLowerCase().includes(search.toLowerCase());
            const matchRole = !roleFilter || u.roles.includes(roleFilter);
            return matchSearch && matchRole;
        }),
    [users, search, roleFilter]);

    function openCreate() {
        reset();
        setEditing(null);
        setShowPassword(false);
        setModalOpen(true);
    }

    function openEdit(user: User) {
        setEditing(user);
        setData({ name: user.name, email: user.email, role: user.roles[0] ?? roles[0]?.name, password: '', _method: 'PUT' });
        setShowPassword(false);
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminUsersUpdate(editing.id) : adminUsersStore();
        post(url, {
            onSuccess: () => {
                setModalOpen(false);
                reset();
            },
        });
    }

    function deleteUser(user: User) {
        if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;
        router.delete(adminUsersDestroy(user.id), {
            onError: (e) => toast.error(Object.values(e)[0] ?? 'Could not delete user.'),
        });
    }

    const roleChip = (role: string) => {
        const c = ROLE_PALETTE[role] ?? { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };
        return (
            <span
                key={role}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
            >
                {role}
            </span>
        );
    };

    return (
        <AdminLayout>
            <Head title="Staff Users — Admin" />
            <Toaster position="top-right" />

            <div className="p-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Staff Users
                        </h1>
                        <p className="mt-1 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {users.length} total · {filtered.length} shown
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        style={{ background: '#2C1A0E', color: '#D4A843' }}
                    >
                        <Plus className="h-4 w-4" /> Add User
                    </button>
                </div>

                {/* Filters */}
                <div className="mb-4 flex gap-3">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or email…"
                            className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm focus:outline-none"
                            style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="rounded-xl border px-3 py-2 text-sm focus:outline-none"
                        style={{ background: 'var(--ap-card)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                    >
                        <option value="">All roles</option>
                        {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-2xl shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>
                                {['User', 'Email', 'Role', 'Joined', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12 text-center">
                                        <Users className="mx-auto mb-2 h-8 w-8 opacity-20" style={{ color: 'var(--ap-muted)' }} />
                                        <p className="text-sm" style={{ color: 'var(--ap-muted)' }}>No users found</p>
                                    </td>
                                </tr>
                            ) : filtered.map((user) => (
                                <tr
                                    key={user.id}
                                    className="border-t transition-colors hover:bg-black/[0.015]"
                                    style={{ borderColor: 'var(--ap-border)' }}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                                style={{ background: avatarColor(user.name) }}
                                            >
                                                {initials(user.name)}
                                            </div>
                                            <span className="font-medium" style={{ color: 'var(--ap-input-text)' }}>{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--ap-muted)' }}>{user.email}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.length > 0 ? user.roles.map(roleChip) : (
                                                <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openEdit(user)}
                                                className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                                            >
                                                <Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                            </button>
                                            <button
                                                onClick={() => deleteUser(user)}
                                                className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
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

                {/* Role legend */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--ap-muted)' }}>Roles:</span>
                    {roles.map((r) => roleChip(r.name))}
                </div>
            </div>

            {/* Create / Edit modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40"
                            style={{ zIndex: 50 }}
                            onClick={() => setModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ background: 'var(--ap-card)', zIndex: 60 }}
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" style={{ color: '#D4A843' }} />
                                    <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                        {editing ? 'Edit User' : 'Add Staff User'}
                                    </h2>
                                </div>
                                <button onClick={() => setModalOpen(false)}>
                                    <X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} />
                                </button>
                            </div>

                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Full Name *</label>
                                    <input
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Juan dela Cruz"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                        style={{ background: 'var(--ap-bg)', borderColor: errors.name ? '#EF4444' : 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Email *</label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="juan@example.com"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                        style={{ background: 'var(--ap-bg)', borderColor: errors.email ? '#EF4444' : 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Role *</label>
                                    <select
                                        value={data.role}
                                        onChange={(e) => setData('role', e.target.value)}
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                        style={{ background: 'var(--ap-bg)', borderColor: errors.role ? '#EF4444' : 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    >
                                        {roles.map((r) => (
                                            <option key={r.id} value={r.name} className="capitalize">{r.name}</option>
                                        ))}
                                    </select>
                                    {errors.role && <p className="mt-1 text-xs text-red-500">{errors.role}</p>}
                                </div>

                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>
                                        {editing ? 'New Password' : 'Password *'}
                                        {editing && <span className="ml-1 text-xs font-normal" style={{ color: 'var(--ap-muted)' }}>(leave blank to keep current)</span>}
                                    </label>
                                    <div className="relative mt-1">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full rounded-xl border py-2 pl-3 pr-10 text-sm focus:outline-none"
                                            style={{ background: 'var(--ap-bg)', borderColor: errors.password ? '#EF4444' : 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2"
                                        >
                                            {showPassword
                                                ? <EyeOff className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                                : <Eye className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                            }
                                        </button>
                                    </div>
                                    {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50"
                                    style={{ background: '#D4A843', color: '#2C1A0E' }}
                                >
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
