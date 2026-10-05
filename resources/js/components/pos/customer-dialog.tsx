import { Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { posCustomersSearch, posCustomersStore } from '@/lib/routes';
import { cn } from '@/lib/utils';
import type { Customer } from './types';
import { apiRequest } from './utils';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (customer: Customer) => void;
}

export function CustomerDialog(props: Props) {
    return props.open ? <CustomerForm {...props} /> : null;
}

function CustomerForm({ open, onOpenChange, onSelect }: Props) {
    const [tab, setTab] = useState<'search' | 'new'>('search');
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<{ query: string; customers: Customer[] }>({ query: '', customers: [] });
    const [form, setForm] = useState({ name: '', phone: '', email: '' });
    const [saving, setSaving] = useState(false);

    // Debounced search; aborting stale requests prevents out-of-order results.
    const query = search.trim();
    const searching = query !== '' && results.query !== query;

    useEffect(() => {
        if (!query) {
 return; 
}

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const customers = await apiRequest<Customer[]>(`${posCustomersSearch()}?q=${encodeURIComponent(query)}`, 'GET', undefined, controller.signal);
                setResults({ query, customers });
            } catch (e) {
                if ((e as Error).name !== 'AbortError') {
 toast.error('Customer search failed'); 
}
            }
        }, 250);

        return () => {
 clearTimeout(timer); controller.abort(); 
};
    }, [query]);

    async function save() {
        if (!form.name.trim()) {
 return; 
}

        setSaving(true);

        try {
            const customer = await apiRequest<Customer>(posCustomersStore(), 'POST', {
                name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null,
            });
            onSelect(customer);
            onOpenChange(false);
            toast.success(`${customer.name} added`);
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <CrudModal open={open} onOpenChange={onOpenChange} title="Select Customer" contentClassName="p-0">
            <div className="flex border-b border-border">
                {(['search', 'new'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn('flex-1 py-3 text-sm font-semibold transition-colors', tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground')}
                    >
                        {t === 'search' ? 'Search Existing' : 'Add New'}
                    </button>
                ))}
            </div>
            <div className="p-5">
                {tab === 'search' ? (
                    <>
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone or email..." className={adminFieldClass() + ' pl-9'} />
                        </div>
                        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                            {searching && <p className="py-4 text-center text-sm text-muted-foreground">Searching...</p>}
                            {!searching && query && results.customers.length === 0 && (
                                <div className="py-6 text-center">
                                    <p className="text-sm text-muted-foreground">No customers found.</p>
                                    <button onClick={() => {
 setTab('new'); setForm((f) => ({ ...f, name: search.trim() })); 
}} className="mt-2 text-sm font-semibold text-primary hover:underline">
                                        <UserPlus className="mr-1 inline h-3.5 w-3.5" />Create "{search.trim()}"
                                    </button>
                                </div>
                            )}
                            {!query && <p className="py-6 text-center text-sm text-muted-foreground">Type to search your customers.</p>}
                            {(query ? results.customers : []).map((c) => (
                                <button key={c.id} onClick={() => {
 onSelect(c); onOpenChange(false); 
}} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{c.name.charAt(0).toUpperCase()}</div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact info'}</p>
                                        {(c.points > 0 || c.cup_count > 0) && (
                                            <p className="mt-0.5 text-xs text-warning">
                                                {c.points > 0 && `★ ${c.points.toLocaleString()} pts`}
                                                {c.points > 0 && c.cup_count > 0 && ' · '}
                                                {c.cup_count > 0 && `☕ ${c.cup_count} cups`}
                                            </p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <form className="space-y-3" onSubmit={(e) => {
 e.preventDefault(); save(); 
}}>
                        <FormField label="Full Name" required>
                            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" className={adminFieldClass()} />
                        </FormField>
                        <FormField label="Phone">
                            <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09171234567" className={adminFieldClass()} />
                        </FormField>
                        <FormField label="Email">
                            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@email.com" className={adminFieldClass()} />
                        </FormField>
                        <Button type="submit" className="w-full" disabled={!form.name.trim() || saving}>{saving ? 'Saving...' : 'Save & Select'}</Button>
                    </form>
                )}
            </div>
        </CrudModal>
    );
}
