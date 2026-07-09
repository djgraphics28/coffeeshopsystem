import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    adminExpensesDestroy, adminExpensesIndex,
    adminExpensesStore, adminExpensesUpdate,
} from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowDownCircle, Calendar, Edit2, Filter, Plus,
    Receipt, Search, Tag, Trash2, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

interface Category { id: number; name: string; color: string }
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
    categories: Category[];
    stats: Stats;
    filters: { category_id?: string; from?: string; to?: string; search?: string };
    settings: { currency: string };
    can: { manage_expenses: boolean };
}

export default function ExpensesIndex({ expenses, categories, stats, filters, settings, can }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);

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

    function fmtDate(iso: string) {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const statCards = [
        { label: 'Total Expenses', value: stats.total, format: 'count', color: '#3B82F6', bg: '#EFF6FF' },
        { label: 'Total Amount', value: stats.total_amount, format: 'currency', color: '#EF4444', bg: '#FEF2F2' },
        { label: 'This Month', value: stats.this_month, format: 'currency', color: '#F59E0B', bg: '#FEF3C7' },
        { label: 'This Week', value: stats.this_week, format: 'currency', color: '#10B981', bg: '#D1FAE5' },
    ];

    const activeFilterCount = [categoryId, from, to, search].filter(Boolean).length;

    return (
        <AdminLayout>
            <Head title="Expenses — Admin" />
            <Toaster position="top-right" />
            <div className="p-6 space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                            Expenses
                        </h1>
                        <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                            {expenses.length} record{expenses.length !== 1 ? 's' : ''}
                            {activeFilterCount > 0 && ` (filtered)`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFilterOpen((v) => !v)}
                            className="relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
                            style={{ border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)', background: 'var(--ap-card)' }}
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: '#EF4444' }}>
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        {can.manage_expenses && (
                            <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                                <Plus className="h-4 w-4" /> Add Expense
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {statCards.map(({ label, value, format, color, bg }) => (
                        <div key={label} className="rounded-2xl p-4 shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium" style={{ color: 'var(--ap-muted)' }}>{label}</p>
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: bg }}>
                                    {format === 'count'
                                        ? <ArrowDownCircle className="h-4 w-4" style={{ color }} />
                                        : <Receipt className="h-4 w-4" style={{ color }} />}
                                </div>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)' }}>
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
                            className="overflow-hidden"
                        >
                            <div className="rounded-2xl p-4" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <div>
                                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ap-muted)' }}>Search</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }} />
                                            <input
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder="Search title..."
                                                className="w-full rounded-xl py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                                style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ap-muted)' }}>Category</label>
                                        <select
                                            value={categoryId}
                                            onChange={(e) => setCategoryId(e.target.value)}
                                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        >
                                            <option value="">All categories</option>
                                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ap-muted)' }}>From</label>
                                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ap-muted)' }}>To</label>
                                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }} />
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button onClick={applyFilters} className="rounded-full px-4 py-1.5 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                                        Apply
                                    </button>
                                    <button onClick={resetFilters} className="rounded-full px-4 py-1.5 text-sm font-medium" style={{ border: '1px solid var(--ap-border)', color: 'var(--ap-muted)' }}>
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Table */}
                <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <table className="w-full text-sm">
                        <thead style={{ background: 'var(--ap-bg)', borderBottom: '1px solid var(--ap-border)' }}>
                            <tr>
                                {['Date', 'Title', 'Category', 'Amount', 'Reference', 'Recorded by', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--ap-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-20 text-center" style={{ color: 'var(--ap-muted)' }}>
                                        <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">No expenses found.</p>
                                        {can.manage_expenses && (
                                            <button onClick={openCreate} className="mt-2 text-sm font-semibold" style={{ color: '#D4A843' }}>
                                                Record your first expense →
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                            {expenses.map((expense) => (
                                <tr key={expense.id} className="group border-t" style={{ borderColor: 'var(--ap-border)' }}>
                                    {/* Date */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ap-muted)' }} />
                                            <span className="text-xs" style={{ color: 'var(--ap-input-text)' }}>{fmtDate(expense.expense_date)}</span>
                                        </div>
                                    </td>
                                    {/* Title */}
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-sm" style={{ color: 'var(--ap-input-text)' }}>{expense.title}</p>
                                        {expense.notes && <p className="mt-0.5 text-xs truncate max-w-[180px]" style={{ color: 'var(--ap-muted)' }}>{expense.notes}</p>}
                                    </td>
                                    {/* Category */}
                                    <td className="px-4 py-3">
                                        {expense.category ? (
                                            <span className="flex items-center gap-1.5 text-xs font-medium">
                                                <Tag className="h-3 w-3" style={{ color: expense.category.color }} />
                                                <span style={{ color: 'var(--ap-input-text)' }}>{expense.category.name}</span>
                                            </span>
                                        ) : <span style={{ color: 'var(--ap-muted)' }}>—</span>}
                                    </td>
                                    {/* Amount */}
                                    <td className="px-4 py-3">
                                        <span className="font-bold text-sm" style={{ color: '#EF4444' }}>
                                            {currency}{Number(expense.amount).toFixed(2)}
                                        </span>
                                    </td>
                                    {/* Reference */}
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {expense.reference_no || '—'}
                                    </td>
                                    {/* User */}
                                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        {expense.user?.name ?? '—'}
                                    </td>
                                    {/* Actions */}
                                    {can.manage_expenses && (
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEdit(expense)} className="rounded-lg p-1.5 hover:bg-black/5">
                                                    <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Delete "${expense.title}"?`)) {
                                                            fetch(adminExpensesDestroy(expense.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } })
                                                                .then(() => window.location.reload());
                                                        }
                                                    }}
                                                    className="rounded-lg p-1.5 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        {expenses.length > 0 && (
                            <tfoot style={{ borderTop: '2px solid var(--ap-border)' }}>
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-right" style={{ color: 'var(--ap-muted)' }}>Total</td>
                                    <td className="px-4 py-3 font-bold" style={{ color: '#EF4444' }}>
                                        {currency}{expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}
                                    </td>
                                    <td colSpan={3} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 shadow-xl"
                            style={{ zIndex: 60, maxHeight: '90vh', background: 'var(--ap-card)' }}
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="text-lg font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                                    {editing ? 'Edit Expense' : 'Record Expense'}
                                </h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Title *</label>
                                        <input
                                            value={data.title}
                                            onChange={(e) => setData('title', e.target.value)}
                                            placeholder="e.g. Office supplies, Electricity..."
                                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        />
                                        {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Amount *</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={data.amount}
                                            onChange={(e) => setData('amount', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        />
                                        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Date *</label>
                                        <input
                                            type="date"
                                            value={data.expense_date}
                                            onChange={(e) => setData('expense_date', e.target.value)}
                                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        />
                                        {errors.expense_date && <p className="mt-1 text-xs text-red-500">{errors.expense_date}</p>}
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Category *</label>
                                        <select
                                            value={data.expense_category_id}
                                            onChange={(e) => setData('expense_category_id', e.target.value)}
                                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        >
                                            <option value="">Select category...</option>
                                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        {errors.expense_category_id && <p className="mt-1 text-xs text-red-500">{errors.expense_category_id}</p>}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Reference No.</label>
                                        <input
                                            value={data.reference_no}
                                            onChange={(e) => setData('reference_no', e.target.value)}
                                            placeholder="Receipt / OR no."
                                            className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--ap-input-text)' }}>Notes</label>
                                        <textarea
                                            value={data.notes}
                                            onChange={(e) => setData('notes', e.target.value)}
                                            rows={2}
                                            placeholder="Additional details..."
                                            className="w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                            style={{ background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' }}
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Record Expense'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}
