import { Head, useForm, usePage } from '@inertiajs/react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminCategoriesDestroy, adminCategoriesStore, adminCategoriesUpdate } from '@/lib/routes';

interface Category {
    id: number;
    name: string;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
    menu_items_count: number;
}

interface Props {
    categories: Category[];
}

export default function CategoriesIndex({ categories }: Props) {
    const { flash } = usePage().props as { flash: { success?: string; error?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | null>(null);
    const [deleting, setDeleting] = useState<Category | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        icon: '',
        sort_order: 0,
        is_active: true as boolean,
    });

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(cat: Category) {
        setEditing(cat);
        setData({ name: cat.name, icon: cat.icon ?? '', sort_order: cat.sort_order, is_active: cat.is_active });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();

        if (editing) {
            put(adminCategoriesUpdate(editing.id), { onSuccess: () => {
 setModalOpen(false); toast.success('Category updated!'); 
} });
        } else {
            post(adminCategoriesStore(), { onSuccess: () => {
 setModalOpen(false); toast.success('Category created!'); 
} });
        }
    }

    function confirmDelete() {
        if (!deleting) {
return;
}

        setDeleteLoading(true);
        fetch(adminCategoriesDestroy(deleting.id), {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' },
        }).then(() => window.location.reload());
    }

    return (
        <AdminLayout>
            <Head title="Categories" />
            <Toaster position="top-right" />

            <PageHeader
                title="Categories"
                breadcrumbs={[{ label: 'Categories' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Add Category
                    </Button>
                }
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-xl">
                                {cat.icon ?? '📁'}
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{cat.name}</p>
                                <p className="text-xs text-muted-foreground">{cat.menu_items_count} items · order #{cat.sort_order}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={cat.is_active ? 'success' : 'neutral'}>{cat.is_active ? 'Active' : 'Hidden'}</Badge>
                            <button onClick={() => openEdit(cat)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                                <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleting(cat)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Category' : 'New Category'}
                footer={
                    <Button type="submit" form="category-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Category'}
                    </Button>
                }
            >
                <form id="category-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Name" required error={errors.name}>
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className={adminFieldClass(!!errors.name)}
                            placeholder="e.g., Espresso Classics"
                        />
                    </FormField>
                    <FormField label="Icon (emoji)">
                        <input
                            value={data.icon}
                            onChange={(e) => setData('icon', e.target.value)}
                            className={adminFieldClass()}
                            placeholder="☕"
                            maxLength={10}
                        />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Sort Order">
                            <input
                                type="number"
                                value={data.sort_order}
                                onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)}
                                className={adminFieldClass()}
                            />
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
                title="Delete category?"
                description={deleting ? `"${deleting.name}" will be permanently removed.` : undefined}
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
