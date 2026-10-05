import { Head, router, usePage } from '@inertiajs/react';
import { Bike, BriefcaseBusiness, Edit2, IdCard, KeyRound, Plus, QrCode, Search, Trash2, UserCheck, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FilterPanel, FilterToggleButton } from '@/components/admin/filter-panel';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { EmployeeFormDialog } from '@/components/hr/employee-form-dialog';
import { IdCardDialog } from '@/components/hr/id-card-dialog';
import { PositionsDialog } from '@/components/hr/positions-dialog';
import { FREQUENCY_SHORT, money    } from '@/components/hr/types';
import type {Employee, PayFrequency, Position} from '@/components/hr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminHrEmployeeCards, adminHrEmployees, adminHrEmployeesUpdate } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface Props {
    employees: Employee[];
    positions: Position[];
    roles: string[];
    filters: { search?: string; position_id?: string; status?: string; pay_frequency?: string };
    stats: { total: number; active: number; drivers: number; with_login: number };
    defaults: { pay_frequency: PayFrequency; shift_start: string; shift_end: string };
    can: { manage: boolean };
    currency: string;
}

export default function EmployeesIndex({ employees, positions, roles, filters, stats, defaults, can, currency }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const activeFilterCount = Object.values(filters).filter(Boolean).length;
    const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
    const [values, setValues] = useState({ search: filters.search ?? '', position_id: filters.position_id ?? '', status: filters.status ?? '', pay_frequency: filters.pay_frequency ?? '' });
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [positionsOpen, setPositionsOpen] = useState(false);
    const [cardFor, setCardFor] = useState<Employee | null>(null);
    const [deleting, setDeleting] = useState<Employee | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        if (flash?.success) {
 toast.success(flash.success); 
}

        if (flash?.error) {
 toast.error(flash.error, { duration: 7000 }); 
}
    }, [flash]);

    function apply(e?: React.FormEvent) {
        e?.preventDefault();
        router.get(adminHrEmployees(), Object.fromEntries(Object.entries(values).filter(([, v]) => v)), { preserveState: true, preserveScroll: true, replace: true });
    }

    function clear() {
        setValues({ search: '', position_id: '', status: '', pay_frequency: '' });
        router.get(adminHrEmployees(), {}, { preserveScroll: true, replace: true });
    }

    function confirmDelete() {
        if (!deleting) {
 return; 
}

        router.delete(adminHrEmployeesUpdate(deleting.id), {
            preserveScroll: true,
            onStart: () => setDeleteLoading(true),
            onFinish: () => {
 setDeleteLoading(false); setDeleting(null); 
},
        });
    }

    const statCards = [
        { label: 'Employees', value: stats.total, icon: Users, tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
        { label: 'Active', value: stats.active, icon: UserCheck, tone: 'bg-success/10 text-success' },
        { label: 'Drivers', value: stats.drivers, icon: Bike, tone: 'bg-info/10 text-info' },
        { label: 'With sign-in', value: stats.with_login, icon: KeyRound, tone: 'bg-warning/10 text-warning' },
    ];

    return (
        <AdminLayout>
            <Head title="Employees" />
            <Toaster position="top-right" />

            <PageHeader
                title="Employees"
                breadcrumbs={[{ label: 'Human Resource' }, { label: 'Employees' }]}
                actions={
                    <>
                        <FilterToggleButton open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} activeCount={activeFilterCount} />
                        <a href={adminHrEmployeeCards()} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"><IdCard className="h-4 w-4" /> Print ID cards</a>
                        <Button variant="outline" onClick={() => setPositionsOpen(true)}><BriefcaseBusiness className="h-4 w-4" /> Positions</Button>
                        {can.manage && <Button onClick={() => {
 setEditing(null); setFormOpen(true); 
}}><Plus className="h-4 w-4" /> Add employee</Button>}
                    </>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">Everyone who works for you, drivers included. Each employee gets an ID and a QR code for clocking in.</p>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statCards.map(({ label, value, icon: Icon, tone }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-5 w-5" /></span>
                        <div><p className="text-xl leading-tight font-bold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
                    </div>
                ))}
            </div>

            <FilterPanel open={filtersOpen} onSubmit={apply}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField label="Search"><div className="relative"><Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={values.search} onChange={(e) => setValues({ ...values, search: e.target.value })} placeholder="Name, ID or phone…" className={adminFieldClass() + ' pl-9'} /></div></FormField>
                    <FormField label="Position"><select value={values.position_id} onChange={(e) => setValues({ ...values, position_id: e.target.value })} className={adminFieldClass()}><option value="">All positions</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
                    <FormField label="Status"><select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })} className={adminFieldClass()}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>
                    <FormField label="Paid"><select value={values.pay_frequency} onChange={(e) => setValues({ ...values, pay_frequency: e.target.value })} className={adminFieldClass()}><option value="">Any schedule</option><option value="daily">Daily</option><option value="half_month">Half-month</option><option value="monthly">Monthly</option></select></FormField>
                </div>
                <div className="mt-3 flex gap-2"><Button type="submit"><Search className="h-4 w-4" /> Apply filters</Button>{activeFilterCount > 0 && <Button type="button" variant="outline" onClick={clear}><X className="h-4 w-4" /> Clear</Button>}</div>
            </FilterPanel>

            <TableCard>
                <TableScroll>
                    <Table className="min-w-[860px]">
                        <TableHead><tr>{['Employee', 'Position', 'Contact', 'Pay', 'Status', 'Access', ''].map((h) => <TableHeadCell key={h}>{h}</TableHeadCell>)}</tr></TableHead>
                        <TableBody>
                            {employees.length === 0 ? (
                                <TableEmpty colSpan={7}>
                                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
                                    <p>{activeFilterCount > 0 ? 'No employees match your filters.' : 'No employees yet.'}</p>
                                    {can.manage && activeFilterCount === 0 && <button onClick={() => {
 setEditing(null); setFormOpen(true); 
}} className="mt-2 text-sm font-semibold text-primary hover:underline">Add your first employee →</button>}
                                </TableEmpty>
                            ) : employees.map((e) => (
                                <TableRow key={e.id} className={e.status === 'inactive' ? 'opacity-60' : undefined}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{e.first_name.charAt(0).toUpperCase()}{e.last_name.charAt(0).toUpperCase()}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-foreground">{e.full_name}</p>
                                                <p className="font-mono text-[11px] text-muted-foreground">{e.employee_code}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="flex items-center gap-1.5 text-sm">{e.position?.name ?? '—'}{e.position?.is_driver && <Bike className="h-3.5 w-3.5 text-info" aria-label="Driver" />}</p>
                                        {e.position?.is_driver && e.vehicle && <p className="text-[11px] text-muted-foreground">{e.vehicle}</p>}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{e.phone ?? '—'}</TableCell>
                                    <TableCell>
                                        <p className="text-sm font-semibold whitespace-nowrap">{money(currency, e.base_salary)}<span className="text-[11px] font-normal text-muted-foreground"> / {e.salary_type === 'daily' ? 'day' : 'month'}</span></p>
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Paid {FREQUENCY_SHORT[e.pay_frequency].toLowerCase()}</span>
                                    </TableCell>
                                    <TableCell><Badge variant={e.status === 'active' ? 'success' : 'neutral'} className="capitalize">{e.status}</Badge></TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {e.user ? <span className="flex items-center gap-1" title={e.user.email}><KeyRound className="h-3.5 w-3.5 text-warning" /> Sign-in</span> : '—'}
                                        {e.has_driver_record && <span className="mt-0.5 flex items-center gap-1"><Bike className="h-3.5 w-3.5 text-info" /> In delivery list</span>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setCardFor(e)} title="ID card & QR code" aria-label={`ID card for ${e.full_name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><QrCode className="h-4 w-4" /></button>
                                            {can.manage && (
                                                <>
                                                    <button onClick={() => {
 setEditing(e); setFormOpen(true); 
}} aria-label={`Edit ${e.full_name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                                                    <button onClick={() => setDeleting(e)} aria-label={`Delete ${e.full_name}`} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>

            <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} positions={positions} roles={roles} defaults={defaults} currency={currency} />
            <PositionsDialog open={positionsOpen} onOpenChange={setPositionsOpen} positions={positions} roles={roles} canManage={can.manage} />
            <IdCardDialog employee={cardFor ? { employee_code: cardFor.employee_code, full_name: cardFor.full_name, position: cardFor.position?.name ?? null } : null} onClose={() => setCardFor(null)} />
            <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} onConfirm={confirmDelete} loading={deleteLoading} title={deleting ? `Delete ${deleting.full_name}?` : 'Delete employee?'} description="Employees with attendance or payroll history can't be deleted. Set them to Inactive instead." confirmLabel="Delete" />
        </AdminLayout>
    );
}
