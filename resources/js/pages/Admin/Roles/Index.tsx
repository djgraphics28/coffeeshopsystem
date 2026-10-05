import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    adminRolesDuplicate,
    adminRolesDestroy,
    adminRolesStore,
    adminRolesTogglePermission,
    adminRolesUpdate,
} from '@/lib/routes';
import { Check, Copy, Edit2, Grid3x3, LayoutGrid, Lock, Plus, Trash2 } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };

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

            <PageHeader
                title="Roles & Permissions"
                breadcrumbs={[{ label: 'Roles' }]}
                actions={
                    <>
                        {/* View toggle */}
                        <div className="flex rounded-xl border border-border bg-muted p-1">
                            <button
                                onClick={() => setView('matrix')}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                    view === 'matrix' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                                )}
                            >
                                <Grid3x3 className="h-3.5 w-3.5" /> Matrix
                            </button>
                            <button
                                onClick={() => setView('cards')}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                    view === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                                )}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" /> Cards
                            </button>
                        </div>
                        <Button onClick={openCreate}>
                            <Plus className="h-4 w-4" /> Add Role
                        </Button>
                    </>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">
                {roles.length} roles · {totalPermissions} permissions · {totalUsers} staff users
            </p>

            {/* Matrix view */}
            {view === 'matrix' && (
                <div className="overflow-x-auto rounded-2xl border border-border shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/60">
                                <th className="w-48 px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
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
                                            <span className="text-xs font-semibold text-foreground capitalize">
                                                {role.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {role.users_count} user{role.users_count !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="w-24 px-3 py-3 text-center text-xs font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(permissionGroups).map(([group, groupPerms]) => {
                                const available = groupPerms.filter((p) => permissionNames.includes(p));
                                if (available.length === 0) return null;

                                return (
                                    <Fragment key={`group-${group}`}>
                                        <tr className="border-t border-border bg-primary/5">
                                            <td colSpan={roles.length + 2} className="px-4 py-2">
                                                <span className="text-[11px] font-bold tracking-widest text-primary uppercase">
                                                    {group}
                                                </span>
                                            </td>
                                        </tr>
                                        {available.map((perm) => (
                                            <tr key={perm} className="border-t border-border transition-colors hover:bg-muted/40">
                                                <td className="px-4 py-2.5">
                                                    <span className="text-sm text-foreground">{perm}</span>
                                                </td>
                                                {roles.map((role) => {
                                                    const has = role.permissions.includes(perm);
                                                    const key = `${role.id}:${perm}`;
                                                    return (
                                                        <td key={role.id} className="px-3 py-2.5 text-center">
                                                            <button
                                                                onClick={() => matrixToggle(role, perm)}
                                                                disabled={toggling === key}
                                                                className={cn(
                                                                    'inline-flex h-6 w-6 items-center justify-center rounded-md border-[1.5px] transition-all',
                                                                    has ? 'border-primary bg-primary/15' : 'border-border bg-background',
                                                                    toggling === key && 'opacity-50',
                                                                )}
                                                            >
                                                                {has && <Check className="h-3.5 w-3.5 text-primary" />}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-2.5" />
                                            </tr>
                                        ))}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        {/* Footer — role actions */}
                        <tfoot className="border-t-2 border-border bg-muted/60">
                            <tr>
                                <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                                    {permissions.length} permissions
                                </td>
                                {roles.map((role) => (
                                    <td key={role.id} className="px-3 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openEdit(role)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="Edit">
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button onClick={() => { setDuplicateModal(role); setDupData('name', `${role.name} copy`); }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="Duplicate">
                                                <Copy className="h-3.5 w-3.5" />
                                            </button>
                                            {!role.is_system && (
                                                <button onClick={() => deleteRole(role)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error" title="Delete">
                                                    <Trash2 className="h-3.5 w-3.5" />
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
                        <div key={role.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
                                            <p className="font-semibold text-foreground capitalize">{role.name}</p>
                                            {role.is_system && <Lock className="h-3 w-3 text-muted-foreground" />}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {role.users_count} user{role.users_count !== 1 ? 's' : ''} · {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(role)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="Edit">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => { setDuplicateModal(role); setDupData('name', `${role.name} copy`); }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary" title="Duplicate">
                                        <Copy className="h-4 w-4" />
                                    </button>
                                    {!role.is_system && (
                                        <button onClick={() => deleteRole(role)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error" title="Delete">
                                            <Trash2 className="h-4 w-4" />
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
                                            <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
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
                                    <p className="text-xs text-muted-foreground">No permissions assigned</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? `Edit "${editing.name}"` : 'New Role'}
                footer={
                    <Button type="submit" form="role-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Role'}
                    </Button>
                }
            >
                <form id="role-form" onSubmit={submit} className="space-y-5">
                    <FormField
                        label="Role Name"
                        required
                        error={errors.name}
                        hint={editing?.is_system ? 'System role name cannot be changed' : undefined}
                    >
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            disabled={editing?.is_system ?? false}
                            placeholder="e.g. supervisor"
                            className={adminFieldClass(!!errors.name) + ' disabled:opacity-50'}
                        />
                    </FormField>

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Permissions</span>
                            <button
                                type="button"
                                onClick={() => {
                                    const all = permissions.map((p) => p.name);
                                    const allChecked = all.every((p) => data.permissions.includes(p));
                                    setData('permissions', allChecked ? [] : all);
                                }}
                                className="text-xs font-medium text-primary hover:underline"
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
                                    <div key={group} className="rounded-xl border border-border bg-muted/40 p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <p className="text-xs font-bold tracking-wide text-foreground uppercase">{group}</p>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group, perms)}
                                                className="text-[10px] font-medium text-primary hover:underline"
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
                                                        className={cn(
                                                            'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                                                            checked ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground',
                                                        )}
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
                </form>
            </CrudModal>

            {/* Duplicate modal */}
            <CrudModal
                open={!!duplicateModal}
                onOpenChange={(open) => !open && setDuplicateModal(null)}
                title={duplicateModal ? `Clone "${duplicateModal.name}"` : 'Clone role'}
                description={duplicateModal ? `A new role will be created with the same ${duplicateModal.permissions.length} permission${duplicateModal.permissions.length !== 1 ? 's' : ''}.` : undefined}
                className="max-w-sm"
                footer={
                    <Button type="submit" form="duplicate-role-form" disabled={dupProcessing} className="w-full sm:w-auto">
                        {dupProcessing ? 'Cloning...' : 'Clone Role'}
                    </Button>
                }
            >
                <form
                    id="duplicate-role-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!duplicateModal) return;
                        postDup(adminRolesDuplicate(duplicateModal.id), {
                            onSuccess: () => { setDuplicateModal(null); resetDup(); },
                        });
                    }}
                >
                    <FormField label="New Role Name" required>
                        <input value={dupData.name} onChange={(e) => setDupData('name', e.target.value)} className={adminFieldClass()} />
                    </FormField>
                </form>
            </CrudModal>
        </AdminLayout>
    );
}
