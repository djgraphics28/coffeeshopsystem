import { Head, useForm } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminAddonGroupsDestroy, adminAddonGroupsStore, adminAddonGroupsUpdate } from '@/lib/routes';

interface Addon { id?: number; name: string; additional_price: number; sort_order: number }
interface AddonGroup { id: number; name: string; is_required: boolean; max_selections: number; sort_order: number; addons: Addon[] }
interface Props { groups: AddonGroup[] }

export default function AddonGroupsIndex({ groups }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AddonGroup | null>(null);
    const [deleting, setDeleting] = useState<AddonGroup | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string; is_required: boolean; max_selections: number; sort_order: number;
        addons: Addon[]; _method?: string;
    }>({ name: '', is_required: false, max_selections: 1, sort_order: 0, addons: [{ name: '', additional_price: 0, sort_order: 1 }] });

    function openCreate() {
 reset(); setData('addons', [{ name: '', additional_price: 0, sort_order: 1 }]); setEditing(null); setModalOpen(true); 
}
    function openEdit(g: AddonGroup) {
        setEditing(g);
        setData({ name: g.name, is_required: g.is_required, max_selections: g.max_selections, sort_order: g.sort_order, addons: g.addons, _method: 'PUT' });
        setModalOpen(true);
    }

    function addAddon() {
 setData('addons', [...data.addons, { name: '', additional_price: 0, sort_order: data.addons.length + 1 }]); 
}
    function removeAddon(i: number) {
 setData('addons', data.addons.filter((_, idx) => idx !== i)); 
}
    function updateAddon(i: number, field: keyof Addon, value: string | number) {
        const updated = [...data.addons];
        (updated[i] as unknown as Record<string, unknown>)[field] = value;
        setData('addons', updated);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminAddonGroupsUpdate(editing.id) : adminAddonGroupsStore();
        post(url, { onSuccess: () => {
 setModalOpen(false); toast.success(editing ? 'Updated!' : 'Created!'); 
} });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    function confirmDelete() {
        if (!deleting) {
return;
}

        setDeleteLoading(true);
        fetch(adminAddonGroupsDestroy(deleting.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload());
    }

    return (
        <AdminLayout>
            <Head title="Add-on Groups" />
            <Toaster position="top-right" />

            <PageHeader
                title="Add-on Groups"
                breadcrumbs={[{ label: 'Add-ons' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Add Group
                    </Button>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold text-foreground">{group.name}</p>
                                <div className="mt-1 flex gap-2">
                                    {group.is_required && <Badge variant="error">Required</Badge>}
                                    <Badge variant="neutral">max {group.max_selections} sel.</Badge>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => openEdit(group)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                                <button onClick={() => setDeleting(group)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1">
                            {group.addons.map((addon) => (
                                <div key={addon.id} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{addon.name}</span>
                                    <span className={Number(addon.additional_price) !== 0 ? 'text-primary' : 'text-muted-foreground'}>
                                        {Number(addon.additional_price) > 0 ? `+₱${addon.additional_price}` : Number(addon.additional_price) < 0 ? `-₱${Math.abs(Number(addon.additional_price))}` : 'Free'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Group' : 'New Add-on Group'}
                footer={
                    <Button type="submit" form="addon-group-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Group'}
                    </Button>
                }
            >
                <form id="addon-group-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Group Name" required error={errors.name}>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className={adminFieldClass(!!errors.name)} placeholder="e.g., Size" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Max Selections">
                            <input type="number" min={1} value={data.max_selections} onChange={(e) => setData('max_selections', parseInt(e.target.value) || 1)} className={adminFieldClass()} />
                        </FormField>
                        <div className="flex items-end pb-2.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <input type="checkbox" checked={data.is_required} onChange={(e) => setData('is_required', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                                Required
                            </label>
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">Options</span>
                            <button type="button" onClick={addAddon} className="text-xs font-medium text-primary hover:underline">+ Add option</button>
                        </div>
                        <div className="space-y-2">
                            {data.addons.map((addon, i) => (
                                <div key={i} className="flex gap-2">
                                    <input value={addon.name} onChange={(e) => updateAddon(i, 'name', e.target.value)} placeholder="Option name" className={cn(adminFieldClass(), 'min-w-0 flex-1')} />
                                    <input type="number" step="0.01" min="0" inputMode="decimal" value={addon.additional_price === 0 ? '' : addon.additional_price} onChange={(e) => updateAddon(i, 'additional_price', parseFloat(e.target.value) || 0)} placeholder="+ Price" aria-label="Extra price" className={cn(adminFieldClass(), 'w-28 shrink-0')} />
                                    {data.addons.length > 1 && (
                                        <button type="button" onClick={() => removeAddon(i)} aria-label="Remove option" className="flex h-10 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-error"><X className="h-4 w-4" /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </form>
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title="Delete add-on group?"
                description={deleting ? `"${deleting.name}" will be permanently removed.` : undefined}
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
