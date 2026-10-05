import { Head, router, useForm, usePage } from '@inertiajs/react';
import type { VariantProps } from 'class-variance-authority';
import { Edit2, Eye, EyeOff, Plus, Search, Shield, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Badge  } from '@/components/ui/badge';
import type {badgeVariants} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminUsersDestroy, adminUsersStore, adminUsersUpdate } from '@/lib/routes';

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

const ROLE_VARIANT: Record<string, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
    admin: 'warning',
    cashier: 'info',
    kitchen: 'success',
};

const AVATAR_COLORS = ['#7C3AED', '#0369A1', '#15803D', '#B45309', '#BE185D', '#0F766E', '#C2410C'];

function avatarColor(name: string) {
    let hash = 0;

    for (let i = 0; i < name.length; i++) {
hash = name.charCodeAt(i) + ((hash << 5) - hash);
}

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
        if (flash?.success) {
toast.success(flash.success);
}

        if (flash?.error) {
toast.error(flash.error);
}
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
        if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) {
return;
}

        router.delete(adminUsersDestroy(user.id), {
            onError: (e) => toast.error(Object.values(e)[0] ?? 'Could not delete user.'),
        });
    }

    const roleChip = (role: string) => (
        <Badge key={role} variant={ROLE_VARIANT[role] ?? 'neutral'} className="capitalize">
            {role}
        </Badge>
    );

    return (
        <AdminLayout>
            <Head title="Staff Users" />
            <Toaster position="top-right" />

            <PageHeader
                title="Staff Users"
                breadcrumbs={[{ label: 'Users' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Add User
                    </Button>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">{users.length} total · {filtered.length} shown</p>

            {/* Filters */}
            <div className="mb-4 flex gap-3">
                <div className="relative max-w-xs flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name or email…"
                        className={adminFieldClass() + ' pl-9'}
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className={adminFieldClass() + ' w-auto'}
                >
                    <option value="">All roles</option>
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <TableCard>
                <TableScroll>
                    <Table>
                        <TableHead>
                            <tr>
                                {['User', 'Email', 'Role', 'Joined', ''].map((h) => (
                                    <TableHeadCell key={h}>{h}</TableHeadCell>
                                ))}
                            </tr>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableEmpty colSpan={5}>
                                    <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-20" />
                                    No users found
                                </TableEmpty>
                            ) : filtered.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                                style={{ background: avatarColor(user.name) }}
                                            >
                                                {initials(user.name)}
                                            </div>
                                            <span className="font-medium text-foreground">{user.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.length > 0 ? user.roles.map(roleChip) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openEdit(user)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => deleteUser(user)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>

            {/* Role legend */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Roles:</span>
                {roles.map((r) => roleChip(r.name))}
            </div>

            {/* Create / Edit modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={
                    <span className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        {editing ? 'Edit User' : 'Add Staff User'}
                    </span>
                }
                footer={
                    <Button type="submit" form="user-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
                    </Button>
                }
            >
                <form id="user-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Full Name" required error={errors.name}>
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Juan dela Cruz"
                            className={adminFieldClass(!!errors.name)}
                        />
                    </FormField>

                    <FormField label="Email" required error={errors.email}>
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="juan@example.com"
                            className={adminFieldClass(!!errors.email)}
                        />
                    </FormField>

                    <FormField label="Role" required error={errors.role}>
                        <select
                            value={data.role}
                            onChange={(e) => setData('role', e.target.value)}
                            className={adminFieldClass(!!errors.role)}
                        >
                            {roles.map((r) => (
                                <option key={r.id} value={r.name} className="capitalize">{r.name}</option>
                            ))}
                        </select>
                    </FormField>

                    <FormField
                        label={editing ? 'New Password' : 'Password'}
                        required={!editing}
                        hint={editing ? 'Leave blank to keep current' : undefined}
                        error={errors.password}
                    >
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                                className={adminFieldClass(!!errors.password) + ' pr-10'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </FormField>
                </form>
            </CrudModal>
        </AdminLayout>
    );
}
