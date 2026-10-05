import { router, useForm } from '@inertiajs/react';
import { ArrowLeft, Bike, Edit2, Plus, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminHrPositionDefaults, adminHrPositions, adminHrPositionsUpdate } from '@/lib/routes';
import type { Position } from './types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    positions: Position[];
    roles: string[];
    canManage: boolean;
}

interface FormData { name: string; description: string; is_driver: boolean; system_role: string; is_active: boolean }
const empty: FormData = { name: '', description: '', is_driver: false, system_role: '', is_active: true };

/** Manage job positions without leaving the Employees page. */
export function PositionsDialog({ open, onOpenChange, positions, roles, canManage }: Props) {
    const [mode, setMode] = useState<'list' | 'form'>('list');
    const [editing, setEditing] = useState<Position | null>(null);
    const [deleting, setDeleting] = useState<Position | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const { data, setData, post, put, processing, errors, reset, clearErrors, transform } = useForm<FormData>(empty);

    transform((d) => ({ ...d, system_role: d.system_role || null }) as never);

    function openForm(position: Position | null) {
        clearErrors();
        setEditing(position);

        if (position) {
            setData({ name: position.name, description: position.description ?? '', is_driver: position.is_driver, system_role: position.system_role ?? '', is_active: position.is_active });
        } else {
            reset();
        }

        setMode('form');
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setMode('list') };

        if (editing) {
 put(adminHrPositionsUpdate(editing.id), options); 
} else {
 post(adminHrPositions(), options); 
}
    }

    function confirmDelete() {
        if (!deleting) {
 return; 
}

        router.delete(adminHrPositionsUpdate(deleting.id), {
            preserveScroll: true,
            onStart: () => setDeleteLoading(true),
            onFinish: () => {
 setDeleteLoading(false); setDeleting(null); 
},
        });
    }

    return (
        <>
            <CrudModal
                open={open}
                onOpenChange={(next) => {
 onOpenChange(next);

 if (!next) {
 setMode('list'); 
} 
}}
                title={mode === 'form'
                    ? <span className="flex items-center gap-2"><button type="button" onClick={() => setMode('list')} aria-label="Back to positions" className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>{editing ? 'Edit position' : 'New position'}</span>
                    : 'Positions'}
                footer={mode === 'form' ? <Button type="submit" form="position-form" disabled={processing}>{processing ? 'Saving…' : editing ? 'Save changes' : 'Add position'}</Button> : undefined}
            >
                {mode === 'list' ? (
                    <div>
                        {canManage && (
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-muted-foreground">{positions.length} position{positions.length === 1 ? '' : 's'}</p>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => router.post(adminHrPositionDefaults(), {}, { preserveScroll: true })}><Wand2 className="h-4 w-4" /> Add defaults</Button>
                                    <Button size="sm" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add position</Button>
                                </div>
                            </div>
                        )}
                        {positions.length === 0 ? (
                            <p className="rounded-xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No positions yet. Click “Add defaults” for Manager, Cashier, Barista, Kitchen Staff, Server, Driver and Utility.</p>
                        ) : (
                            <ul className="divide-y divide-border rounded-xl border border-border">
                                {positions.map((p) => (
                                    <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                                                {p.name}
                                                {p.is_driver && <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info"><Bike className="h-3 w-3" /> Driver</span>}
                                                {!p.is_active && <Badge variant="neutral">Inactive</Badge>}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{p.employees_count ?? 0} employee{p.employees_count === 1 ? '' : 's'}{p.system_role ? ` · login role: ${p.system_role}` : ''}</p>
                                        </div>
                                        {canManage && (
                                            <>
                                                <button onClick={() => openForm(p)} aria-label={`Edit ${p.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => (p.employees_count ? toast.error('Move its employees to another position first') : setDeleting(p))} aria-label={`Delete ${p.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <form id="position-form" onSubmit={submit} className="space-y-4">
                        <FormField label="Position name" required error={errors.name}><input autoFocus value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Cashier, Driver, Barista" className={adminFieldClass(!!errors.name)} /></FormField>
                        <FormField label="Description" error={errors.description}><input value={data.description} onChange={(e) => setData('description', e.target.value)} className={adminFieldClass()} /></FormField>
                        <FormField label="Login role" error={errors.system_role} hint="The role given to an employee's sign-in account in this position.">
                            <select value={data.system_role} onChange={(e) => setData('system_role', e.target.value)} className={adminFieldClass()}>
                                <option value="">No default role</option>
                                {roles.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                            </select>
                        </FormField>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3">
                            <input type="checkbox" checked={data.is_driver} onChange={(e) => setData('is_driver', e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                            <span><span className="block text-sm font-semibold text-foreground">This is a driver position</span><span className="block text-xs text-muted-foreground">Employees here are added to the Delivery Men list automatically (name, phone, vehicle and login stay in sync).</span></span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                            <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="h-4 w-4 accent-primary" /> Active (can be chosen for new employees)
                        </label>
                    </form>
                )}
            </CrudModal>
            <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} onConfirm={confirmDelete} loading={deleteLoading} title={deleting ? `Delete "${deleting.name}"?` : 'Delete position?'} confirmLabel="Delete" />
        </>
    );
}
