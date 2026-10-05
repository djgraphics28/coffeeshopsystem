import { router, useForm } from '@inertiajs/react';
import { ArrowLeft, Edit2, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminExpenseCategoriesDestroy, adminExpenseCategoriesStore, adminExpenseCategoriesUpdate } from '@/lib/routes';

export interface ManagedExpenseCategory {
    id: number;
    name: string;
    description: string | null;
    color: string;
    is_active: boolean;
    expenses_count: number;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: ManagedExpenseCategory[];
}

const PRESET_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#2C1A0E', '#D4A843'];

type FormData = { name: string; description: string; color: string; is_active: boolean; _method?: string };
const emptyForm: FormData = { name: '', description: '', color: '#6B7280', is_active: true };

/** Manage expense categories without leaving the Expenses page. */
export function ExpenseCategoriesDialog({ open, onOpenChange, categories }: Props) {
    const [mode, setMode] = useState<'list' | 'form'>('list');
    const [editing, setEditing] = useState<ManagedExpenseCategory | null>(null);
    const [deleting, setDeleting] = useState<ManagedExpenseCategory | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<FormData>(emptyForm);

    function openCreate() {
        reset(); clearErrors(); setEditing(null); setMode('form');
    }

    function openEdit(cat: ManagedExpenseCategory) {
        clearErrors();
        setEditing(cat);
        setData({ name: cat.name, description: cat.description ?? '', color: cat.color, is_active: cat.is_active, _method: 'PUT' });
        setMode('form');
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(editing ? adminExpenseCategoriesUpdate(editing.id) : adminExpenseCategoriesStore(), {
            preserveScroll: true,
            onSuccess: () => setMode('list'),
        });
    }

    function requestDelete(cat: ManagedExpenseCategory) {
        if (cat.expenses_count > 0) {
            toast.error('Cannot delete — this category has expenses');

            return;
        }

        setDeleting(cat);
    }

    function confirmDelete() {
        if (!deleting) {
 return; 
}

        router.delete(adminExpenseCategoriesDestroy(deleting.id), {
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
                title={
                    mode === 'form' ? (
                        <span className="flex items-center gap-2">
                            <button type="button" onClick={() => setMode('list')} aria-label="Back to categories" className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
                                <ArrowLeft className="h-4 w-4" />
                            </button>
                            {editing ? 'Edit Category' : 'New Category'}
                        </span>
                    ) : 'Expense Categories'
                }
                footer={
                    mode === 'form' ? (
                        <Button type="submit" form="expense-category-form" disabled={processing} className="w-full sm:w-auto">
                            {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
                        </Button>
                    ) : undefined
                }
            >
                {mode === 'list' ? (
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
                            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add Category</Button>
                        </div>
                        {categories.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-12">
                                <FolderOpen className="mb-2 h-10 w-10 text-muted-foreground opacity-20" />
                                <p className="text-sm text-muted-foreground">No expense categories yet.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border rounded-xl border border-border">
                                {categories.map((cat) => (
                                    <li key={cat.id} className="flex items-center gap-3 px-3 py-2.5">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: cat.color }}>
                                            {cat.name.charAt(0).toUpperCase()}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{cat.name}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {cat.expenses_count} expense{cat.expenses_count !== 1 ? 's' : ''}{cat.description ? ` · ${cat.description}` : ''}
                                            </p>
                                        </div>
                                        <Badge variant={cat.is_active ? 'success' : 'neutral'}>{cat.is_active ? 'Active' : 'Inactive'}</Badge>
                                        <button onClick={() => openEdit(cat)} aria-label={`Edit ${cat.name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => requestDelete(cat)} aria-label={`Delete ${cat.name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : (
                    <form id="expense-category-form" onSubmit={submit} className="space-y-4">
                        <FormField label="Name" required error={errors.name}>
                            <input autoFocus value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="e.g. Supplies, Utilities..." className={adminFieldClass(!!errors.name)} />
                        </FormField>
                        <FormField label="Description" error={errors.description}>
                            <input value={data.description} onChange={(e) => setData('description', e.target.value)} placeholder="Optional description" className={adminFieldClass()} />
                        </FormField>
                        <FormField label="Color" error={errors.color}>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c} type="button" aria-label={`Color ${c}`} onClick={() => setData('color', c)}
                                        className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                                        style={{ background: c, outline: data.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                                    />
                                ))}
                                <input type="color" value={data.color} onChange={(e) => setData('color', e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border-0 p-0.5" title="Custom color" />
                            </div>
                        </FormField>
                        <label className="flex cursor-pointer items-center gap-2">
                            <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                            <span className="text-sm font-medium text-foreground">Active</span>
                        </label>
                    </form>
                )}
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(next) => !next && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title={deleting ? `Delete "${deleting.name}"?` : 'Delete category?'}
                confirmLabel="Delete"
            />
        </>
    );
}
