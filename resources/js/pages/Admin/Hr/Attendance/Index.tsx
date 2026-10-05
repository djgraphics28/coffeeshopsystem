import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CalendarCheck, Clock, ExternalLink, Hourglass, Plus, Search, Timer, Trash2, UserCheck, X, Edit2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FilterPanel, FilterToggleButton } from '@/components/admin/filter-panel';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { hoursMinutes } from '@/components/hr/types';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminHrAttendance, adminHrAttendanceUpdate, attendanceKiosk } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
    id: number; employee_id: number; employee_name: string | null; employee_code: string | null; position: string | null;
    work_date: string; time_in: string; time_out: string | null; time_out_next_day: boolean;
    worked_minutes: number; late_minutes: number; overtime_minutes: number; source: string; note: string | null;
}

interface Props {
    records: AttendanceRecord[];
    summary: { records: number; worked_minutes: number; late_count: number; late_minutes: number; overtime_minutes: number };
    clocked_in: Array<{ id: number; name: string | null; code: string | null; since: string }>;
    employees: Array<{ id: number; name: string; code: string; status: string }>;
    filters: { from: string; to: string; employee_id: string | null };
    can: { manage: boolean };
}

const to12h = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface FormData { employee_id: string; work_date: string; time_in: string; time_out: string; note: string }

export default function AttendanceIndex({ records, summary, clocked_in, employees, filters, can }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [employeeId, setEmployeeId] = useState(filters.employee_id ?? '');
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AttendanceRecord | null>(null);
    const [deleting, setDeleting] = useState<AttendanceRecord | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [now] = useState(() => Date.now());

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm<FormData>({ employee_id: '', work_date: iso(new Date()), time_in: '', time_out: '', note: '' });

    useEffect(() => {
        if (flash?.success) {
 toast.success(flash.success); 
}

        if (flash?.error) {
 toast.error(flash.error); 
}
    }, [flash]);

    function go(params: Record<string, string>) {
        router.get(adminHrAttendance(), params, { preserveScroll: true, preserveState: true, replace: true });
    }

    function apply(e?: React.FormEvent) {
        e?.preventDefault();
        go({ from, to, ...(employeeId ? { employee_id: employeeId } : {}) });
    }

    function quick(range: 'today' | 'week' | 'month') {
        const today = new Date();
        const start = new Date(today);

        if (range === 'week') {
 start.setDate(today.getDate() - ((today.getDay() + 6) % 7)); 
}

        if (range === 'month') {
 start.setDate(1); 
}

        setFrom(iso(start)); setTo(iso(today));
        go({ from: iso(start), to: iso(today), ...(employeeId ? { employee_id: employeeId } : {}) });
    }

    function openForm(record: AttendanceRecord | null) {
        clearErrors();
        setEditing(record);

        if (record) {
            setData({ employee_id: String(record.employee_id), work_date: record.work_date, time_in: record.time_in, time_out: record.time_out ?? '', note: record.note ?? '' });
        } else {
            reset();
            setData({ employee_id: '', work_date: iso(new Date()), time_in: '', time_out: '', note: '' });
        }

        setFormOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setFormOpen(false) };

        if (editing) {
 put(adminHrAttendanceUpdate(editing.id), options); 
} else {
 post(adminHrAttendance(), options); 
}
    }

    function confirmDelete() {
        if (!deleting) {
 return; 
}

        router.delete(adminHrAttendanceUpdate(deleting.id), {
            preserveScroll: true,
            onStart: () => setDeleteLoading(true),
            onFinish: () => {
 setDeleteLoading(false); setDeleting(null); 
},
        });
    }

    const stats = [
        { label: 'Records', value: String(summary.records), icon: CalendarCheck, tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
        { label: 'Hours worked', value: hoursMinutes(summary.worked_minutes), icon: Clock, tone: 'bg-success/10 text-success' },
        { label: 'Late arrivals', value: `${summary.late_count}`, hint: summary.late_minutes ? hoursMinutes(summary.late_minutes) : undefined, icon: Hourglass, tone: 'bg-warning/10 text-warning' },
        { label: 'Overtime', value: hoursMinutes(summary.overtime_minutes), icon: Timer, tone: 'bg-info/10 text-info' },
    ];

    return (
        <AdminLayout>
            <Head title="Attendance" />
            <Toaster position="top-right" />

            <PageHeader
                title="Attendance"
                breadcrumbs={[{ label: 'Human Resource' }, { label: 'Attendance' }]}
                actions={
                    <>
                        <FilterToggleButton open={filtersOpen} onToggle={() => setFiltersOpen((v) => !v)} activeCount={employeeId ? 1 : 0} />
                        <a href={attendanceKiosk()} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"><ExternalLink className="h-4 w-4" /> Clock-in screen</a>
                        {can.manage && <Button onClick={() => openForm(null)}><Plus className="h-4 w-4" /> Add record</Button>}
                    </>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">Employees clock in and out on the clock-in screen. Fix forgotten punches here.</p>

            {clocked_in.length > 0 && (
                <div className="mb-6 rounded-2xl border border-success/30 bg-success/5 p-4">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"><UserCheck className="h-4 w-4 text-success" /> Clocked in right now ({clocked_in.length})</p>
                    <div className="flex flex-wrap gap-2">
                        {clocked_in.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs">
                                <span className="h-2 w-2 rounded-full bg-success" />
                                <b className="text-foreground">{c.name}</b>
                                <span className="text-muted-foreground">since {new Date(c.since).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} · {hoursMinutes(Math.max(0, Math.floor((now - new Date(c.since).getTime()) / 60000)))}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.map(({ label, value, hint, icon: Icon, tone }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-5 w-5" /></span>
                        <div><p className="text-xl leading-tight font-bold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}{hint ? ` · ${hint}` : ''}</p></div>
                    </div>
                ))}
            </div>

            <FilterPanel open={filtersOpen} onSubmit={apply}>
                <div className="mb-3 flex flex-wrap gap-2">
                    {(['today', 'week', 'month'] as const).map((r) => (
                        <button key={r} type="button" onClick={() => quick(r)} className="rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground">{r === 'today' ? 'Today' : r === 'week' ? 'This week' : 'This month'}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <FormField label="From"><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={adminFieldClass()} /></FormField>
                    <FormField label="To"><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={adminFieldClass()} /></FormField>
                    <FormField label="Employee"><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={adminFieldClass()}><option value="">Everyone</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select></FormField>
                    <div className="flex items-end gap-2"><Button type="submit"><Search className="h-4 w-4" /> Apply</Button>{employeeId && <Button type="button" variant="outline" onClick={() => {
 setEmployeeId(''); go({ from, to }); 
}}><X className="h-4 w-4" /> Clear</Button>}</div>
                </div>
            </FilterPanel>

            <TableCard>
                <TableScroll>
                    <Table className="min-w-[820px]">
                        <TableHead><tr>{['Date', 'Employee', 'In', 'Out', 'Hours', 'Late', 'Overtime', 'Source', ''].map((h) => <TableHeadCell key={h}>{h}</TableHeadCell>)}</tr></TableHead>
                        <TableBody>
                            {records.length === 0 ? (
                                <TableEmpty colSpan={9}>No attendance in this period.</TableEmpty>
                            ) : records.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.work_date)}</TableCell>
                                    <TableCell><p className="text-sm font-semibold text-foreground">{r.employee_name}</p><p className="font-mono text-[11px] text-muted-foreground">{r.employee_code}{r.position ? ` · ${r.position}` : ''}</p></TableCell>
                                    <TableCell className="text-sm font-medium whitespace-nowrap">{to12h(r.time_in)}</TableCell>
                                    <TableCell className="text-sm font-medium whitespace-nowrap">{r.time_out ? <>{to12h(r.time_out)}{r.time_out_next_day && <span className="ml-1 text-[10px] text-muted-foreground">+1 day</span>}</> : <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Still in</span>}</TableCell>
                                    <TableCell className="text-sm whitespace-nowrap">{r.time_out ? hoursMinutes(r.worked_minutes) : '—'}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{r.late_minutes > 0 ? <span className="font-semibold text-warning">{r.late_minutes} min</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{r.overtime_minutes > 0 ? <span className="font-semibold text-info">{hoursMinutes(r.overtime_minutes)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', r.source === 'manual' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')} title={r.note ?? undefined}>{r.source}</span></TableCell>
                                    <TableCell>
                                        {can.manage && (
                                            <div className="flex gap-1">
                                                <button onClick={() => openForm(r)} aria-label="Edit record" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-4 w-4" /></button>
                                                <button onClick={() => setDeleting(r)} aria-label="Delete record" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-4 w-4" /></button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>

            <CrudModal
                open={formOpen}
                onOpenChange={setFormOpen}
                title={editing ? 'Edit attendance' : 'Add attendance'}
                description="Use this when someone forgot to clock in or out. Late and overtime are worked out automatically."
                className="max-w-md"
                footer={<Button type="submit" form="attendance-form" disabled={processing}>{processing ? 'Saving…' : editing ? 'Save changes' : 'Add record'}</Button>}
            >
                <form id="attendance-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Employee" required error={errors.employee_id}>
                        <select value={data.employee_id} onChange={(e) => setData('employee_id', e.target.value)} className={adminFieldClass(!!errors.employee_id)}>
                            <option value="">Select an employee…</option>
                            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code}){e.status === 'inactive' ? ' — inactive' : ''}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Date" required error={errors.work_date}><input type="date" max={iso(new Date())} value={data.work_date} onChange={(e) => setData('work_date', e.target.value)} className={adminFieldClass(!!errors.work_date)} /></FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Time in" required error={errors.time_in}><input type="time" value={data.time_in} onChange={(e) => setData('time_in', e.target.value)} className={adminFieldClass(!!errors.time_in)} /></FormField>
                        <FormField label="Time out" error={errors.time_out} hint="Earlier than time in = next morning"><input type="time" value={data.time_out} onChange={(e) => setData('time_out', e.target.value)} className={adminFieldClass(!!errors.time_out)} /></FormField>
                    </div>
                    <FormField label="Note" error={errors.note}><input value={data.note} onChange={(e) => setData('note', e.target.value)} placeholder="e.g. Forgot to clock in" className={adminFieldClass()} /></FormField>
                </form>
            </CrudModal>

            <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} onConfirm={confirmDelete} loading={deleteLoading} title="Delete this attendance record?" description="This also changes any payroll you recalculate afterwards." confirmLabel="Delete" />
        </AdminLayout>
    );
}
