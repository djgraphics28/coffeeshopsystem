import { Head, router, useForm, usePage } from '@inertiajs/react';
import { adminCustomersDestroy, adminCustomersShow, adminCustomersStore, adminCustomersUpdate, adminCustomersVerifyEmail } from '@/lib/routes';
import { BadgeCheck, Coffee, Edit2, Gift, Plus, Star, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { CrudModal } from '@/components/admin/crud-modal';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';

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
    const [deleting, setDeleting] = useState<Customer | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

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

    function confirmDelete() {
        if (!deleting) return;
        setDeleteLoading(true);
        fetch(adminCustomersDestroy(deleting.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } })
            .then(() => window.location.reload());
    }

    function fmtDate(iso: string | null) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const statCards = [
        { label: 'Total Customers', value: stats.total, icon: Users, tone: 'brand' as const },
        { label: 'Points Outstanding', value: stats.total_points_outstanding.toLocaleString(), icon: Star, tone: 'warning' as const },
        { label: 'Loyalty Members', value: stats.loyalty_members, icon: Coffee, tone: 'success' as const },
        { label: 'Free Drinks Available', value: stats.free_drinks_available, icon: Gift, tone: 'error' as const },
    ];

    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        warning: 'bg-warning/10 text-warning',
        success: 'bg-success/10 text-success',
        error: 'bg-error/10 text-error',
    };

    return (
        <AdminLayout>
            <Head title="Customers — Admin" />
            <Toaster position="top-right" />

            <PageHeader
                title="Customers"
                breadcrumbs={[{ label: 'Customers' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Add Customer
                    </Button>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">{stats.total} registered customers</p>

            {/* Stats cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {statCards.map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
                                <Icon className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <TableCard>
                <TableScroll>
                    <Table>
                        <TableHead>
                            <tr>
                                {['Customer', 'Contact', 'Orders', 'Total Spent', 'Points', 'Cups', 'Free Drinks', 'Last Order', ''].map((h) => (
                                    <TableHeadCell key={h}>{h}</TableHeadCell>
                                ))}
                            </tr>
                        </TableHead>
                        <TableBody>
                            {customers.length === 0 && <TableEmpty colSpan={9}>No customers yet.</TableEmpty>}
                            {customers.map((customer) => (
                                <TableRow
                                    key={customer.id}
                                    className="cursor-pointer"
                                    onClick={() => window.location.href = adminCustomersShow(customer.id)}
                                >
                                    {/* Customer */}
                                    <TableCell>
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                                {customer.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-foreground">{customer.name}</p>
                                                {customer.notes && <p className="max-w-[120px] truncate text-[10px] text-muted-foreground">{customer.notes}</p>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    {/* Contact */}
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-xs text-muted-foreground">{customer.email ?? '—'}</p>
                                            {customer.email && customer.email_verified_at && (
                                                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{customer.phone ?? ''}</p>
                                    </TableCell>
                                    {/* Orders */}
                                    <TableCell><Badge variant="warning">{customer.orders_count}</Badge></TableCell>
                                    {/* Total spent */}
                                    <TableCell className="text-xs font-semibold">
                                        {customer.orders_sum_total != null ? `₱${Number(customer.orders_sum_total).toFixed(2)}` : '—'}
                                    </TableCell>
                                    {/* Points */}
                                    <TableCell>
                                        <span className="flex items-center gap-1 text-xs font-semibold text-warning">
                                            <Star className="h-3 w-3" />
                                            {customer.points.toLocaleString()}
                                        </span>
                                    </TableCell>
                                    {/* Cups */}
                                    <TableCell className="text-xs text-muted-foreground">
                                        {customer.cup_count > 0
                                            ? <span className="font-medium text-foreground">☕ {customer.cup_count}</span>
                                            : '—'
                                        }
                                    </TableCell>
                                    {/* Free drinks */}
                                    <TableCell>
                                        {customer.free_drinks_available > 0
                                            ? <Badge variant="success">🎁 {customer.free_drinks_available}</Badge>
                                            : <span className="text-xs text-muted-foreground">—</span>
                                        }
                                    </TableCell>
                                    {/* Last order */}
                                    <TableCell className="text-xs text-muted-foreground">
                                        {fmtDate(customer.last_order_at)}
                                    </TableCell>
                                    {/* Actions */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-1">
                                            {customer.email && !customer.email_verified_at && (
                                                <button
                                                    onClick={() => { if (confirm(`Manually verify ${customer.name}'s email?`)) router.post(adminCustomersVerifyEmail(customer.id)); }}
                                                    className="flex items-center gap-1 rounded-lg border border-warning/30 px-2 py-1.5 text-xs font-semibold text-warning transition-colors hover:bg-warning/10"
                                                >
                                                    <BadgeCheck className="h-3.5 w-3.5" />
                                                    Verify Email
                                                </button>
                                            )}
                                            <div className="flex gap-1">
                                                <button onClick={(e) => openEdit(e, customer)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => setDeleting(customer)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>

            {/* Create / Edit modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Customer' : 'New Customer'}
                footer={
                    <Button type="submit" form="customer-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
                    </Button>
                }
            >
                <form id="customer-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Full Name" required error={errors.name}>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className={adminFieldClass(!!errors.name)} />
                    </FormField>
                    <FormField label="Phone" error={errors.phone}>
                        <input value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="e.g. 09171234567" className={adminFieldClass(!!errors.phone)} />
                    </FormField>
                    <FormField label="Email" error={errors.email}>
                        <input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className={adminFieldClass(!!errors.email)} />
                    </FormField>
                    <FormField label="Notes">
                        <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} placeholder="Allergies, preferences..." className={adminFieldClass() + ' resize-none'} />
                    </FormField>
                </form>
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title={deleting ? `Delete ${deleting.name}?` : 'Delete customer?'}
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
