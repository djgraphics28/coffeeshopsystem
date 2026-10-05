import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    adminExpensesDestroy, adminExpensesIndex,
    adminExpensesStore, adminExpensesUpdate,
} from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowDownCircle, Calendar, Edit2, Filter, Plus,
    Receipt, Search, Tag, Tags, Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { CrudModal } from '@/components/admin/crud-modal';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { ExpenseCategoriesDialog } from '@/components/admin/expense-categories-dialog';
import { Button } from '@/components/ui/button';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';

interface Category { id: number; name: string; color: string }
interface ManagedCategory extends Category { description: string | null; is_active: boolean; expenses_count: number }
interface Expense {
    id: number;
    title: string;
    amount: number;
    expense_date: string;
    notes: string | null;
    reference_no: string | null;
    category: Category | null;
    user: { name: string } | null;
    created_at: string;
}
interface Stats {
    total: number;
    total_amount: number;
    this_month: number;
    this_week: number;
}
interface Props {
    expenses: Expense[];
    categories: ManagedCategory[];
    stats: Stats;
    filters: { category_id?: string; from?: string; to?: string; search?: string };
    settings: { currency: string };
    can: { manage_expenses: boolean; manage_categories: boolean };
}

export default function ExpensesIndex({ expenses, categories, stats, filters, settings, can }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const [deleting, setDeleting] = useState<Expense | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // local filter state
    const [search, setSearch] = useState(filters.search ?? '');
    const [categoryId, setCategoryId] = useState(filters.category_id ?? '');
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');

    const currency = settings.currency;

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    function applyFilters() {
        router.get(adminExpensesIndex(), { search: search || undefined, category_id: categoryId || undefined, from: from || undefined, to: to || undefined }, { preserveState: true });
    }

    function resetFilters() {
        setSearch(''); setCategoryId(''); setFrom(''); setTo('');
        router.get(adminExpensesIndex(), {}, { preserveState: false });
    }

    const { data, setData, post, processing, errors, reset } = useForm<{
        expense_category_id: string; title: string; amount: string;
        expense_date: string; notes: string; reference_no: string; _method?: string;
    }>({
        expense_category_id: '', title: '', amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: '', reference_no: '',
    });

    function openCreate() {
        reset();
        setData('expense_date', new Date().toISOString().split('T')[0]);
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(expense: Expense) {
        setEditing(expense);
        setData({
            expense_category_id: String(expense.category?.id ?? ''),
            title: expense.title,
            amount: String(expense.amount),
            expense_date: expense.expense_date,
            notes: expense.notes ?? '',
            reference_no: expense.reference_no ?? '',
            _method: 'PUT',
        });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const url = editing ? adminExpensesUpdate(editing.id) : adminExpensesStore();
        post(url, { onSuccess: () => setModalOpen(false) });
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    function confirmDelete() {
        if (!deleting) return;
        setDeleteLoading(true);
        fetch(adminExpensesDestroy(deleting.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } })
            .then(() => window.location.reload());
    }

    function fmtDate(iso: string) {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const statCards = [
        { label: 'Total Expenses', value: stats.total, format: 'count', tone: 'brand' as const },
        { label: 'Total Amount', value: stats.total_amount, format: 'currency', tone: 'error' as const },
        { label: 'This Month', value: stats.this_month, format: 'currency', tone: 'warning' as const },
        { label: 'This Week', value: stats.this_week, format: 'currency', tone: 'success' as const },
    ];
    const toneClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
        warning: 'bg-warning/10 text-warning',
        success: 'bg-success/10 text-success',
        error: 'bg-error/10 text-error',
    };

    const activeFilterCount = [categoryId, from, to, search].filter(Boolean).length;

    return (
        <AdminLayout>
            <Head title="Expenses — Admin" />
            <Toaster position="top-right" />

            <PageHeader
                title="Expenses"
                breadcrumbs={[{ label: 'Expenses' }]}
                actions={
                    <>
                        <Button variant="outline" className="relative" onClick={() => setFilterOpen((v) => !v)}>
                            <Filter className="h-4 w-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                        {can.manage_categories && (
                            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
                                <Tags className="h-4 w-4" /> Categories
                            </Button>
                        )}
                        {can.manage_expenses && (
                            <Button onClick={openCreate}>
                                <Plus className="h-4 w-4" /> Add Expense
                            </Button>
                        )}
                    </>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">
                {expenses.length} record{expenses.length !== 1 ? 's' : ''}
                {activeFilterCount > 0 && ` (filtered)`}
            </p>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {statCards.map(({ label, value, format, tone }) => (
                    <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">{label}</p>
                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
                                {format === 'count' ? <ArrowDownCircle className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            {format === 'currency' ? `${currency}${Number(value).toFixed(2)}` : value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <AnimatePresence>
                {filterOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 overflow-hidden"
                    >
                        <div className="rounded-2xl border border-border bg-card p-4">
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                <FormField label="Search">
                                    <div className="relative">
                                        <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                        <input
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search title..."
                                            className={adminFieldClass() + ' pl-8'}
                                        />
                                    </div>
                                </FormField>
                                <FormField label="Category">
                                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={adminFieldClass()}>
                                        <option value="">All categories</option>
                                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </FormField>
                                <FormField label="From">
                                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={adminFieldClass()} />
                                </FormField>
                                <FormField label="To">
                                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={adminFieldClass()} />
                                </FormField>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Button size="sm" onClick={applyFilters}>Apply</Button>
                                <Button size="sm" variant="outline" onClick={resetFilters}>Reset</Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Table */}
            <TableCard>
                <TableScroll>
                    <Table>
                        <TableHead>
                            <tr>
                                {['Date', 'Title', 'Category', 'Amount', 'Reference', 'Recorded by', ''].map((h) => (
                                    <TableHeadCell key={h}>{h}</TableHeadCell>
                                ))}
                            </tr>
                        </TableHead>
                        <TableBody>
                            {expenses.length === 0 && (
                                <TableEmpty colSpan={7}>
                                    <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-20" />
                                    <p>No expenses found.</p>
                                    {can.manage_expenses && (
                                        <button onClick={openCreate} className="mt-2 text-sm font-semibold text-primary hover:underline">
                                            Record your first expense →
                                        </button>
                                    )}
                                </TableEmpty>
                            )}
                            {expenses.map((expense) => (
                                <TableRow key={expense.id}>
                                    {/* Date */}
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="text-xs">{fmtDate(expense.expense_date)}</span>
                                        </div>
                                    </TableCell>
                                    {/* Title */}
                                    <TableCell>
                                        <p className="text-sm font-semibold">{expense.title}</p>
                                        {expense.notes && <p className="mt-0.5 max-w-[180px] truncate text-xs text-muted-foreground">{expense.notes}</p>}
                                    </TableCell>
                                    {/* Category */}
                                    <TableCell>
                                        {expense.category ? (
                                            <span className="flex items-center gap-1.5 text-xs font-medium">
                                                <Tag className="h-3 w-3" style={{ color: expense.category.color }} />
                                                {expense.category.name}
                                            </span>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    {/* Amount */}
                                    <TableCell>
                                        <span className="text-sm font-bold text-error">
                                            {currency}{Number(expense.amount).toFixed(2)}
                                        </span>
                                    </TableCell>
                                    {/* Reference */}
                                    <TableCell className="text-xs text-muted-foreground">
                                        {expense.reference_no || '—'}
                                    </TableCell>
                                    {/* User */}
                                    <TableCell className="text-xs text-muted-foreground">
                                        {expense.user?.name ?? '—'}
                                    </TableCell>
                                    {/* Actions */}
                                    {can.manage_expenses && (
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openEdit(expense)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => setDeleting(expense)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                        {expenses.length > 0 && (
                            <tfoot className="border-t-2 border-border">
                                <tr>
                                    <td colSpan={3} className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">Total</td>
                                    <td className="px-5 py-3 font-bold text-error">
                                        {currency}{expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}
                                    </td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        )}
                    </Table>
                </TableScroll>
            </TableCard>

            {/* Create / Edit Modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Expense' : 'Record Expense'}
                footer={
                    <Button type="submit" form="expense-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Record Expense'}
                    </Button>
                }
            >
                <form id="expense-form" onSubmit={submit} className="grid grid-cols-2 gap-4">
                    <FormField label="Title" required error={errors.title} className="col-span-2">
                        <input
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="e.g. Office supplies, Electricity..."
                            className={adminFieldClass(!!errors.title)}
                        />
                    </FormField>
                    <FormField label="Amount" required error={errors.amount}>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={data.amount}
                            onChange={(e) => setData('amount', e.target.value)}
                            placeholder="0.00"
                            className={adminFieldClass(!!errors.amount)}
                        />
                    </FormField>
                    <FormField label="Date" required error={errors.expense_date}>
                        <input
                            type="date"
                            value={data.expense_date}
                            onChange={(e) => setData('expense_date', e.target.value)}
                            className={adminFieldClass(!!errors.expense_date)}
                        />
                    </FormField>
                    <FormField label="Category" required error={errors.expense_category_id} className="col-span-2">
                        <select
                            value={data.expense_category_id}
                            onChange={(e) => setData('expense_category_id', e.target.value)}
                            className={adminFieldClass(!!errors.expense_category_id)}
                        >
                            <option value="">Select category...</option>
                            {categories.filter((c) => c.is_active || String(c.id) === data.expense_category_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Reference No.">
                        <input
                            value={data.reference_no}
                            onChange={(e) => setData('reference_no', e.target.value)}
                            placeholder="Receipt / OR no."
                            className={adminFieldClass()}
                        />
                    </FormField>
                    <FormField label="Notes" className="col-span-2">
                        <textarea
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            rows={2}
                            placeholder="Additional details..."
                            className={adminFieldClass() + ' resize-none'}
                        />
                    </FormField>
                </form>
            </CrudModal>

            {can.manage_categories && (
                <ExpenseCategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={categories} />
            )}

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title={deleting ? `Delete "${deleting.title}"?` : 'Delete expense?'}
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
