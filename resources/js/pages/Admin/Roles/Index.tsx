import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    adminRolesDuplicate,
    adminRolesDestroy,
    adminRolesStore,
    adminRolesTogglePermission,
    adminRolesUpdate,
} from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Edit2, Grid3x3, LayoutGrid, Lock, Plus, Shield, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Role {
    id: number;
    name: string;
    permissions: string[];
    users_count: number;
    is_system: boolean;
}

interface Permission {
    id: number;
    name: string;
}

interface Props {
    roles: Role[];
    permissions: Permission[];
    permissionGroups: Record<string, string[]>;
}

type ViewMode = 'cards' | 'matrix';

const ROLE_COLORS = ['#7C3AED', '#0369A1', '#15803D', '#B45309', '#BE185D', '#0F766E', '#C2410C'];
const roleColor = (index: number) => ROLE_COLORS[index % ROLE_COLORS.length];

function initials(name: string) {
    return name.slice(0, 2).toUpperCase();
}

export default function RolesIndex({ roles: initialRoles, permissions, permissionGroups }: Props) {
    const { flash, errors: pageErrors } = usePage().props as { flash?: { success?: string; error?: string }; errors?: Record<string, string> };

    const [roles, setRoles] = useState(initialRoles);
    const [view, setView] = useState<ViewMode>('matrix');
    const [modalOpen, setModalOpen] = useState(false);
    const [duplicateModal, setDuplicateModal] = useState<Role | null>(null);
    const [editing, setEditing] = useState<Role | null>(null);
    const [toggling, setToggling] = useState<string>(''); // "roleId:permission"

    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string;
        permissions: string[];
        _method?: string;
    }>({ name: '', permissions: [] });

    const { data: dupData, setData: setDupData, post: postDup, processing: dupProcessing, reset: resetDup } = useForm({ name: '' });

    const permissionNames = permissions.map((p) => p.name);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    // Keep local roles in sync after Inertia reload
    useEffect(() => { setRoles(initialRoles); }, [initialRoles]);

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(role: Role) {
        setEditing(role);
        setData({ name: role.name, permissions: [...role.permissions], _method: 'PUT' });
        setModalOpen(true);
    }

    function togglePermission(perm: string) {
        setData('permissions', data.permissions.includes(perm)
            ? data.permissions.filter((p) => p !== perm)
            : [...data.permissions, perm]);
    }

    function toggleGroup(group: string, groupPerms: string[]) {
        const available = groupPerms.filter((p) => permissionNames.includes(p));
        const allChecked = available.every((p) => data.permissions.includes(p));
        if (allChecked) {
            setData('permissions', data.permissions.filter((p) => !available.includes(p)));
        } else {
            setData('permissions', [...new Set([...data.permissions, ...available])]);
        }
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminRolesUpdate(editing.id) : adminRolesStore();
        post(url, { onSuccess: () => { setModalOpen(false); reset(); } });
    }

    function deleteRole(role: Role) {
        if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
        router.delete(adminRolesDestroy(role.id), {
            onError: (e) => toast.error(Object.values(e)[0] ?? 'Could not delete role.'),
        });
    }

    // Matrix inline toggle — optimistic UI
    async function matrixToggle(role: Role, permission: string) {
        const key = `${role.id}:${permission}`;
        if (toggling === key) return;
        setToggling(key);

        const hasIt = role.permissions.includes(permission);

        setRoles((prev) =>
            prev.map((r) =>
                r.id === role.id
                    ? { ...r, permissions: hasIt ? r.permissions.filter((p) => p !== permission) : [...r.permissions, permission] }
                    : r,
            ),
        );

        try {
            const res = await fetch(adminRolesTogglePermission(role.id), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ permission }),
            });

            if (!res.ok) {
                // revert
                setRoles((prev) =>
                    prev.map((r) =>
                        r.id === role.id
                            ? { ...r, permissions: hasIt ? [...r.permissions, permission] : r.permissions.filter((p) => p !== permission) }
                            : r,
                    ),
                );
                toast.error('Failed to update permission.');
            }
        } catch {
            setRoles(initialRoles);
            toast.error('Network error.');
        } finally {
            setToggling('');
        }
    }

    const totalPermissions = permissions.length;
    const totalUsers = roles.reduce((s, r) => s + r.users_count, 0);

    return (
        <AdminLayout>
            <Head title="Roles & Permissions — Admin" />
            <Toaster position="top-right" />

            <div className="p-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Roles & Permissions
                        </h1>
                        <p className="mt-1 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {roles.length} roles · {totalPermissions} permissions · {totalUsers} staff users
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="flex rounded-xl border p-1" style={{ borderColor: 'var(--ap-border)', background: 'var(--ap-bg)' }}>
                            <button
                                onClick={() => setView('matrix')}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{ background: view === 'matrix' ? '#2C1A0E' : 'transparent', color: view === 'matrix' ? '#D4A843' : 'var(--ap-muted)' }}
                            >
                                <Grid3x3 className="h-3.5 w-3.5" /> Matrix
                            </button>
                            <button
                                onClick={() => setView('cards')}
                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                                style={{ background: view === 'cards' ? '#2C1A0E' : 'transparent', color: view === 'cards' ? '#D4A843' : 'var(--ap-muted)' }}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" /> Cards
                            </button>
                        </div>
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                            style={{ background: '#2C1A0E', color: '#D4A843' }}
                        >
                            <Plus className="h-4 w-4" /> Add Role
                        </button>
                    </div>
                </div>

                {/* Matrix view */}
                {view === 'matrix' && (
                    <div className="overflow-x-auto rounded-2xl shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                                    <th className="w-48 px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>
                                        Permission
                                    </th>
                                    {roles.map((role, i) => (
                                        <th key={role.id} className="px-3 py-3 text-center" style={{ minWidth: 110 }}>
                                            <div className="flex flex-col items-center gap-1">
                                                <div
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                                                    style={{ background: roleColor(i) }}
                                                >
                                                    {initials(role.name)}
                                                </div>
                                                <span className="text-xs font-semibold capitalize" style={{ color: 'var(--ap-input-text)' }}>
                                                    {role.name}
                                                </span>
                                                <span className="text-[10px]" style={{ color: 'var(--ap-muted)' }}>
                                                    {role.users_count} user{role.users_count !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </th>
                                    ))}
                                    <th className="w-24 px-3 py-3 text-center text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(permissionGroups).map(([group, groupPerms]) => {
                                    const available = groupPerms.filter((p) => permissionNames.includes(p));
                                    if (available.length === 0) return null;

                                    return (
                                        <>
                                            <tr key={`group-${group}`} style={{ background: 'rgba(212,168,67,0.06)', borderTop: '1px solid var(--ap-border)' }}>
                                                <td colSpan={roles.length + 2} className="px-4 py-2">
                                                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#D4A843' }}>
                                                        {group}
                                                    </span>
                                                </td>
                                            </tr>
                                            {available.map((perm) => (
                                                <tr
                                                    key={perm}
                                                    className="border-t transition-colors hover:bg-black/[0.02]"
                                                    style={{ borderColor: 'var(--ap-border)' }}
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <span className="text-sm" style={{ color: 'var(--ap-input-text)' }}>{perm}</span>
                                                    </td>
                                                    {roles.map((role) => {
                                                        const has = role.permissions.includes(perm);
                                                        const key = `${role.id}:${perm}`;
                                                        return (
                                                            <td key={role.id} className="px-3 py-2.5 text-center">
                                                                <button
                                                                    onClick={() => matrixToggle(role, perm)}
                                                                    disabled={toggling === key}
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-all"
                                                                    style={{
                                                                        background: has ? 'rgba(212,168,67,0.15)' : 'var(--ap-bg)',
                                                                        border: `1.5px solid ${has ? '#D4A843' : 'var(--ap-border)'}`,
                                                                        opacity: toggling === key ? 0.5 : 1,
                                                                    }}
                                                                >
                                                                    {has && <Check className="h-3.5 w-3.5" style={{ color: '#D4A843' }} />}
                                                                </button>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-2.5" />
                                                </tr>
                                            ))}
                                        </>
                                    );
                                })}
                            </tbody>
                            {/* Footer — role actions */}
                            <tfoot style={{ borderTop: '2px solid var(--ap-border)', background: 'var(--ap-bg)' }}>
                                <tr>
                                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>
                                        {permissions.length} permissions
                                    </td>
                                    {roles.map((role, i) => (
                                        <td key={role.id} className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => openEdit(role)}
                                                    className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                                </button>
                                                <button
                                                    onClick={() => { setDuplicateModal(role); setDupData('name', `${role.name} copy`); }}
                                                    className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
                                                    title="Duplicate"
                                                >
                                                    <Copy className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                                </button>
                                                {!role.is_system && (
                                                    <button
                                                        onClick={() => deleteRole(role)}
                                                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    ))}
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* Card view */}
                {view === 'cards' && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {roles.map((role, i) => (
                            <div
                                key={role.id}
                                className="rounded-2xl p-5 shadow-sm"
                                style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}
                            >
                                <div className="mb-4 flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                                            style={{ background: roleColor(i) }}
                                        >
                                            {initials(role.name)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-semibold capitalize" style={{ color: 'var(--ap-input-text)' }}>{role.name}</p>
                                                {role.is_system && (
                                                    <Lock className="h-3 w-3" style={{ color: 'var(--ap-muted)' }} title="System role" />
                                                )}
                                            </div>
                                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>
                                                {role.users_count} user{role.users_count !== 1 ? 's' : ''} · {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEdit(role)}
                                            className="rounded-lg p-1.5 hover:bg-black/5"
                                            title="Edit"
                                        >
                                            <Edit2 className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                        </button>
                                        <button
                                            onClick={() => { setDuplicateModal(role); setDupData('name', `${role.name} copy`); }}
                                            className="rounded-lg p-1.5 hover:bg-black/5"
                                            title="Duplicate"
                                        >
                                            <Copy className="h-4 w-4" style={{ color: 'var(--ap-muted)' }} />
                                        </button>
                                        {!role.is_system && (
                                            <button
                                                onClick={() => deleteRole(role)}
                                                className="rounded-lg p-1.5 hover:bg-red-50"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-400" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Permissions grouped */}
                                <div className="space-y-2">
                                    {Object.entries(permissionGroups).map(([group, perms]) => {
                                        const granted = perms.filter((p) => role.permissions.includes(p));
                                        if (granted.length === 0) return null;
                                        return (
                                            <div key={group}>
                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ap-muted)' }}>{group}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {granted.map((perm) => (
                                                        <span
                                                            key={perm}
                                                            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                                            style={{ background: `${roleColor(i)}15`, color: roleColor(i), border: `1px solid ${roleColor(i)}40` }}
                                                        >
                                                            {perm}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {role.permissions.length === 0 && (
                                        <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>No permissions assigned</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 shadow-xl"
                            style={{ background: 'var(--ap-card)' }}
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {editing ? `Edit "${editing.name}"` : 'New Role'}
                                </h2>
                                <button onClick={() => setModalOpen(false)}>
                                    <X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} />
                                </button>
                            </div>

                            <form onSubmit={submit} className="space-y-5">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Role Name *</label>
                                    <input
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        disabled={editing?.is_system ?? false}
                                        placeholder="e.g. supervisor"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
                                        style={{ background: 'var(--ap-bg)', borderColor: errors.name ? '#EF4444' : 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                    {editing?.is_system && (
                                        <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                            <Lock className="h-3 w-3" /> System role name cannot be changed
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <div className="mb-3 flex items-center justify-between">
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Permissions</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const all = permissions.map((p) => p.name);
                                                const allChecked = all.every((p) => data.permissions.includes(p));
                                                setData('permissions', allChecked ? [] : all);
                                            }}
                                            className="text-xs font-medium"
                                            style={{ color: '#D4A843' }}
                                        >
                                            {permissions.every((p) => data.permissions.includes(p.name)) ? 'Deselect all' : 'Select all'}
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {Object.entries(permissionGroups).map(([group, perms]) => {
                                            const available = perms.filter((p) => permissionNames.includes(p));
                                            if (available.length === 0) return null;
                                            const allGroupChecked = available.every((p) => data.permissions.includes(p));

                                            return (
                                                <div key={group} className="rounded-xl p-3" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)' }}>
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ap-input-text)' }}>{group}</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleGroup(group, perms)}
                                                            className="text-[10px] font-medium"
                                                            style={{ color: '#D4A843' }}
                                                        >
                                                            {allGroupChecked ? 'Deselect' : 'Select all'}
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {available.map((perm) => {
                                                            const checked = data.permissions.includes(perm);
                                                            return (
                                                                <label
                                                                    key={perm}
                                                                    className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors"
                                                                    style={{
                                                                        background: checked ? 'rgba(212,168,67,0.15)' : 'var(--ap-card)',
                                                                        border: `1px solid ${checked ? '#D4A843' : 'var(--ap-border)'}`,
                                                                        color: checked ? '#D4A843' : 'var(--ap-muted)',
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => togglePermission(perm)}
                                                                        className="sr-only"
                                                                    />
                                                                    {checked && <Check className="h-3 w-3" />}
                                                                    {perm}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50"
                                    style={{ background: '#D4A843', color: '#2C1A0E' }}
                                >
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Role'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Duplicate modal */}
            <AnimatePresence>
                {duplicateModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40"
                            style={{ zIndex: 50 }}
                            onClick={() => setDuplicateModal(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl"
                            style={{ background: 'var(--ap-card)' }}
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    Clone "{duplicateModal.name}"
                                </h2>
                                <button onClick={() => setDuplicateModal(null)}>
                                    <X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} />
                                </button>
                            </div>
                            <p className="mb-4 text-sm" style={{ color: 'var(--ap-muted)' }}>
                                A new role will be created with the same {duplicateModal.permissions.length} permission{duplicateModal.permissions.length !== 1 ? 's' : ''}.
                            </p>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    postDup(adminRolesDuplicate(duplicateModal.id), {
                                        onSuccess: () => { setDuplicateModal(null); resetDup(); },
                                    });
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>New Role Name *</label>
                                    <input
                                        value={dupData.name}
                                        onChange={(e) => setDupData('name', e.target.value)}
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                                        style={{ background: 'var(--ap-bg)', borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={dupProcessing}
                                    className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50"
                                    style={{ background: '#D4A843', color: '#2C1A0E' }}
                                >
                                    {dupProcessing ? 'Cloning...' : 'Clone Role'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
