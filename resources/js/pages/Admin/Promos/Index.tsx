import { Head, useForm } from '@inertiajs/react';
import { adminPromosDestroy, adminPromosStore, adminPromosUpdate } from '@/lib/routes';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { CrudModal } from '@/components/admin/crud-modal';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';

interface Promo {
    id: number;
    code: string;
    name: string;
    description: string | null;
    type: 'percentage' | 'fixed';
    value: number;
    min_order_amount: number;
    max_uses: number | null;
    uses_count: number;
    per_customer_limit: number | null;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

interface Props { promos: Promo[] }

export default function PromosIndex({ promos }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Promo | null>(null);
    const [deleting, setDeleting] = useState<Promo | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm<{
        code: string; name: string; description: string; type: 'percentage' | 'fixed';
        value: string; min_order_amount: string; max_uses: string; per_customer_limit: string;
        expires_at: string; is_active: boolean; _method?: string;
    }>({
        code: '', name: '', description: '', type: 'percentage',
        value: '', min_order_amount: '0', max_uses: '', per_customer_limit: '',
        expires_at: '', is_active: true,
    });

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(promo: Promo) {
        setEditing(promo);
        setData({
            code: promo.code,
            name: promo.name,
            description: promo.description ?? '',
            type: promo.type,
            value: String(promo.value),
            min_order_amount: String(promo.min_order_amount),
            max_uses: promo.max_uses != null ? String(promo.max_uses) : '',
            per_customer_limit: promo.per_customer_limit != null ? String(promo.per_customer_limit) : '',
            expires_at: promo.expires_at ? promo.expires_at.slice(0, 16) : '',
            is_active: promo.is_active,
            _method: 'PUT',
        });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminPromosUpdate(editing.id) : adminPromosStore();
        post(url, { onSuccess: () => { setModalOpen(false); toast.success(editing ? 'Promo updated!' : 'Promo created!'); } });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    function confirmDelete() {
        if (!deleting) return;
        setDeleteLoading(true);
        fetch(adminPromosDestroy(deleting.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload());
    }

    function formatExpiry(iso: string | null) {
        if (!iso) return <span className="text-muted-foreground">—</span>;
        const d = new Date(iso);
        return d < new Date() ? <span className="text-xs text-error">Expired</span> : <span className="text-xs text-muted-foreground">{d.toLocaleDateString()}</span>;
    }

    return (
        <AdminLayout>
            <Head title="Promos — Admin" />
            <Toaster position="top-right" />

            <PageHeader
                title="Promo Codes"
                breadcrumbs={[{ label: 'Promos' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Add Promo
                    </Button>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">{promos.length} promo{promos.length !== 1 ? 's' : ''}</p>

            <TableCard>
                <TableScroll>
                    <Table>
                        <TableHead>
                            <tr>
                                {['Code', 'Name', 'Discount', 'Min Order', 'Uses', 'Expires', 'Status', ''].map((h) => (
                                    <TableHeadCell key={h}>{h}</TableHeadCell>
                                ))}
                            </tr>
                        </TableHead>
                        <TableBody>
                            {promos.length === 0 && <TableEmpty colSpan={8}>No promos yet.</TableEmpty>}
                            {promos.map((promo) => (
                                <TableRow key={promo.id}>
                                    <TableCell>
                                        <code className="rounded bg-muted px-2 py-0.5 text-xs font-bold text-foreground">{promo.code}</code>
                                    </TableCell>
                                    <TableCell className="font-medium">{promo.name}</TableCell>
                                    <TableCell className="font-semibold text-primary">
                                        {promo.type === 'percentage' ? `${promo.value}%` : `₱${promo.value}`}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {promo.min_order_amount > 0 ? `₱${promo.min_order_amount}` : '—'}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {promo.uses_count}{promo.max_uses ? `/${promo.max_uses}` : ''}
                                    </TableCell>
                                    <TableCell>{formatExpiry(promo.expires_at)}</TableCell>
                                    <TableCell>
                                        <Badge variant={promo.is_active ? 'success' : 'neutral'}>{promo.is_active ? 'Active' : 'Inactive'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(promo)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                                            <button onClick={() => setDeleting(promo)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>

            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Promo' : 'New Promo'}
                footer={
                    <Button type="submit" form="promo-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Promo'}
                    </Button>
                }
            >
                <form id="promo-form" onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Code" required error={errors.code}>
                            <input value={data.code} onChange={(e) => setData('code', e.target.value.toUpperCase())} placeholder="SUMMER20" className={adminFieldClass(!!errors.code) + ' font-mono'} />
                        </FormField>
                        <FormField label="Name" required error={errors.name}>
                            <input value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Summer Sale" className={adminFieldClass(!!errors.name)} />
                        </FormField>
                    </div>

                    <FormField label="Description">
                        <input value={data.description} onChange={(e) => setData('description', e.target.value)} className={adminFieldClass()} />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Type" required>
                            <select value={data.type} onChange={(e) => setData('type', e.target.value as 'percentage' | 'fixed')} className={adminFieldClass()}>
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (₱)</option>
                            </select>
                        </FormField>
                        <FormField label="Value" required error={errors.value}>
                            <input type="number" min="0" step="0.01" value={data.value} onChange={(e) => setData('value', e.target.value)} placeholder={data.type === 'percentage' ? '20' : '50'} className={adminFieldClass(!!errors.value)} />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Min Order (₱)">
                            <input type="number" min="0" step="0.01" value={data.min_order_amount} onChange={(e) => setData('min_order_amount', e.target.value)} className={adminFieldClass()} />
                        </FormField>
                        <FormField label="Max Total Uses">
                            <input type="number" min="1" value={data.max_uses} onChange={(e) => setData('max_uses', e.target.value)} placeholder="Unlimited" className={adminFieldClass()} />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Per Customer Limit">
                            <input type="number" min="1" value={data.per_customer_limit} onChange={(e) => setData('per_customer_limit', e.target.value)} placeholder="Unlimited" className={adminFieldClass()} />
                        </FormField>
                        <FormField label="Expires At">
                            <input type="datetime-local" value={data.expires_at} onChange={(e) => setData('expires_at', e.target.value)} className={adminFieldClass()} />
                        </FormField>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                        <span className="text-sm font-medium text-foreground">Active</span>
                        <button
                            type="button"
                            onClick={() => setData('is_active', !data.is_active)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${data.is_active ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: data.is_active ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </form>
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title={deleting ? `Delete promo ${deleting.code}?` : 'Delete promo?'}
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
