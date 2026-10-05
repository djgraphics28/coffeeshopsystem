import { Head, useForm, router } from '@inertiajs/react';
import { adminDeliveryMenAccount, adminDeliveryMenDestroy, adminDeliveryMenStore, adminDeliveryMenUpdate } from '@/lib/routes';
import { Bike, Edit2, KeyRound, Phone, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { CrudModal } from '@/components/admin/crud-modal';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    const [deleteLoading, setDeleteLoading] = useState(false);
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
        setDeleteLoading(true);
        router.delete(adminDeliveryMenDestroy(deleting.id), {
            onSuccess: () => { setDeleting(null); toast.success('Delivery man removed.'); },
            onFinish: () => setDeleteLoading(false),
        });
    }

    return (
        <AdminLayout>
            <Head title="Delivery Men — Admin" />
            <Toaster position="top-right" />

            <PageHeader
                title="Delivery Men"
                breadcrumbs={[{ label: 'Delivery Men' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Add Delivery Man
                    </Button>
                }
            />

            {delivery_men.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-border bg-card py-16 text-muted-foreground shadow-sm">
                    <Bike className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">No delivery men yet — add your first rider.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {delivery_men.map((man) => (
                        <div key={man.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                                        {man.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{man.name}</p>
                                        <Badge variant={man.is_active ? 'success' : 'neutral'}>{man.is_active ? 'Active' : 'Inactive'}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => openEdit(man)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => setDeleting(man)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                {man.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {man.phone}</p>}
                                {man.vehicle && <p className="flex items-center gap-1.5"><Bike className="h-3 w-3" /> {man.vehicle}</p>}
                            </div>

                            <button
                                onClick={() => openAccount(man)}
                                className="mt-3 flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-2 text-left text-xs transition-colors hover:bg-muted/70"
                            >
                                <KeyRound className={`h-3.5 w-3.5 shrink-0 ${man.user ? 'text-success' : 'text-primary'}`} />
                                {man.user ? (
                                    <span className="truncate text-foreground">
                                        <span className="font-semibold text-success">Driver app login</span> · {man.user.email}
                                    </span>
                                ) : (
                                    <span className="font-semibold text-primary">Create driver app login</span>
                                )}
                            </button>

                            <div className="mt-3 flex gap-2 border-t border-border pt-3">
                                <div className="flex-1 rounded-xl bg-muted px-2 py-1.5 text-center">
                                    <p className={`text-sm font-bold ${man.active_deliveries_count > 0 ? 'text-warning' : 'text-foreground'}`}>{man.active_deliveries_count}</p>
                                    <p className="text-[10px] text-muted-foreground">On delivery</p>
                                </div>
                                <div className="flex-1 rounded-xl bg-muted px-2 py-1.5 text-center">
                                    <p className="text-sm font-bold text-foreground">{man.total_deliveries_count}</p>
                                    <p className="text-[10px] text-muted-foreground">Total</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Delivery Man' : 'New Delivery Man'}
                className="max-w-sm"
                footer={
                    <Button type="submit" form="delivery-man-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Add Delivery Man'}
                    </Button>
                }
            >
                <form id="delivery-man-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Name" required error={errors.name}>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className={adminFieldClass(!!errors.name)} placeholder="e.g., Juan Dela Cruz" />
                    </FormField>
                    <FormField label="Phone" error={errors.phone}>
                        <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} className={adminFieldClass(!!errors.phone)} placeholder="09171234567" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Vehicle">
                            <input value={data.vehicle} onChange={(e) => setData('vehicle', e.target.value)} className={adminFieldClass()} placeholder="Motorcycle" />
                        </FormField>
                        <div className="flex items-end pb-2.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                                Active
                            </label>
                        </div>
                    </div>
                </form>
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title={deleting ? `Remove ${deleting.name}?` : 'Remove delivery man?'}
                description="Past orders keep their records; the rider will simply be unassigned."
                confirmLabel="Remove"
            />

            {/* Driver account modal */}
            <CrudModal
                open={!!accountFor}
                onOpenChange={(open) => !open && setAccountFor(null)}
                title={accountFor?.user ? 'Driver Account' : 'Create Driver Account'}
                description={accountFor ? <>{accountFor.name} signs in at <span className="font-mono font-semibold">/login</span> and lands on the driver app.</> : undefined}
                className="max-w-sm"
                footer={
                    <Button type="submit" form="driver-account-form" disabled={savingAccount} className="w-full sm:w-auto">
                        {savingAccount ? 'Saving...' : accountFor?.user ? 'Update Account' : 'Create Account'}
                    </Button>
                }
            >
                <form id="driver-account-form" onSubmit={saveAccount} className="space-y-4">
                    <FormField label="Email" required error={accountErrors.email}>
                        <input
                            type="email"
                            value={accountEmail}
                            onChange={(e) => setAccountEmail(e.target.value)}
                            className={adminFieldClass(!!accountErrors.email)}
                            placeholder="rider@example.com"
                        />
                    </FormField>
                    <FormField
                        label={accountFor?.user ? 'New Password (leave blank to keep current)' : 'Password'}
                        required={!accountFor?.user}
                        error={accountErrors.password}
                    >
                        <input
                            type="password"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            className={adminFieldClass(!!accountErrors.password)}
                            placeholder="Min. 8 characters"
                        />
                    </FormField>
                </form>
            </CrudModal>
        </AdminLayout>
    );
}
