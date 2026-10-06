import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Banknote, ChevronRight, FileText, Plus, Settings2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { PayrollSettingsDialog } from '@/components/hr/payroll-settings-dialog';
import { FREQUENCY_SHORT, STATUS_STYLE, money   } from '@/components/hr/types';
import type {PayFrequency, PayrollRun} from '@/components/hr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminHrPayroll, adminHrPayrollShow } from '@/lib/routes';
import { cn, localDateString } from '@/lib/utils';

interface Props {
    runs: PayrollRun[];
    employee_counts: Record<PayFrequency, number>;
    settings: Record<string, string>;
    can: { manage: boolean };
    currency: string;
}

const today = () => localDateString();
const thisMonth = () => localDateString().slice(0, 7);

export default function PayrollIndex({ runs, employee_counts, settings, can, currency }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [createOpen, setCreateOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm<{ frequency: PayFrequency; anchor: string; half: string; notes: string }>({
        frequency: 'monthly', anchor: thisMonth(), half: '1', notes: '',
    });

    useEffect(() => {
        if (flash?.success) {
 toast.success(flash.success); 
}

        if (flash?.error) {
 toast.error(flash.error, { duration: 8000 }); 
}
    }, [flash]);

    const cutoff = Number(settings.hr_half_month_cutoff ?? 15);
    const preview = useMemo(() => {
        if (data.frequency === 'daily') {
 return data.anchor ? new Date(`${data.anchor}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''; 
}

        if (!/^\d{4}-\d{2}$/.test(data.anchor)) {
 return ''; 
}

        const [y, m] = data.anchor.split('-').map(Number);
        const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
        const last = new Date(y, m, 0).getDate();

        if (data.frequency === 'monthly') {
 return `${monthName} (1 – ${last})`; 
}

        return data.half === '1' ? `${monthName}: 1 – ${cutoff}` : `${monthName}: ${cutoff + 1} – ${last}`;
    }, [data.frequency, data.anchor, data.half, cutoff]);

    function changeFrequency(f: PayFrequency) {
        setData((d) => ({ ...d, frequency: f, anchor: f === 'daily' ? today() : /^\d{4}-\d{2}$/.test(d.anchor) ? d.anchor : thisMonth() }));
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(adminHrPayroll(), { preserveScroll: true, onSuccess: () => {
 setCreateOpen(false); reset(); 
} });
    }

    const err = errors as Record<string, string | undefined>;
    const periodEnd = useMemo(() => {
        if (data.frequency === 'daily') {
 return data.anchor || null; 
}

        if (!/^\d{4}-\d{2}$/.test(data.anchor)) {
 return null; 
}

        const [y, m] = data.anchor.split('-').map(Number);
        const last = new Date(y, m, 0).getDate();
        const day = data.frequency === 'half_month' && data.half === '1' ? cutoff : last;

        return `${data.anchor}-${String(day).padStart(2, '0')}`;
    }, [data.frequency, data.anchor, data.half, cutoff]);
    const notFinished = !!periodEnd && periodEnd > today();
    const eligible = employee_counts[data.frequency] ?? 0;

    return (
        <AdminLayout>
            <Head title="Payroll" />
            <Toaster position="top-right" />

            <PageHeader
                title="Payroll"
                breadcrumbs={[{ label: 'Human Resource' }, { label: 'Payroll' }]}
                actions={
                    <>
                        <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 className="h-4 w-4" /> Settings</Button>
                        {can.manage && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New payroll</Button>}
                    </>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">Pay is worked out from attendance. Each employee is paid daily, half-month or monthly — set on their profile.</p>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(['daily', 'half_month', 'monthly'] as const).map((f) => (
                    <div key={f} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Users className="h-5 w-5" /></span>
                        <div><p className="text-xl leading-tight font-bold text-foreground">{employee_counts[f] ?? 0}</p><p className="text-xs text-muted-foreground">paid {FREQUENCY_SHORT[f].toLowerCase()}</p></div>
                    </div>
                ))}
            </div>

            <TableCard>
                <TableScroll>
                    <Table className="min-w-[760px]">
                        <TableHead><tr>{['Payroll', 'Period', 'Paid', 'Employees', 'Gross', 'Net pay', 'Status', ''].map((h) => <TableHeadCell key={h}>{h}</TableHeadCell>)}</tr></TableHead>
                        <TableBody>
                            {runs.length === 0 ? (
                                <TableEmpty colSpan={8}>
                                    <Banknote className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-30" />
                                    <p>No payroll yet.</p>
                                    {can.manage && <button onClick={() => setCreateOpen(true)} className="mt-2 text-sm font-semibold text-primary hover:underline">Create your first payroll →</button>}
                                </TableEmpty>
                            ) : runs.map((r) => (
                                <TableRow key={r.id} className="cursor-pointer" onClick={() => router.visit(adminHrPayrollShow(r.id))}>
                                    <TableCell className="font-mono text-xs font-bold whitespace-nowrap text-primary">{r.reference}</TableCell>
                                    <TableCell className="text-sm font-medium whitespace-nowrap">{r.label}</TableCell>
                                    <TableCell><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{FREQUENCY_SHORT[r.frequency]}</span></TableCell>
                                    <TableCell className="text-sm">{r.payslips_count ?? 0}</TableCell>
                                    <TableCell className="text-sm whitespace-nowrap">{money(currency, r.gross_total ?? 0)}</TableCell>
                                    <TableCell className="text-sm font-bold whitespace-nowrap text-primary">{money(currency, r.net_total ?? 0)}</TableCell>
                                    <TableCell><Badge variant={STATUS_STYLE[r.status].variant}>{STATUS_STYLE[r.status].label}</Badge></TableCell>
                                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>

            <CrudModal
                open={createOpen}
                onOpenChange={setCreateOpen}
                title="New payroll"
                description="Creates a draft with one payslip for every active employee on that pay schedule. You can review and adjust it before approving."
                className="max-w-xl"
                footer={<Button type="submit" form="payroll-form" disabled={processing || eligible === 0 || notFinished}><FileText className="h-4 w-4" /> {processing ? 'Creating…' : 'Create payroll'}</Button>}
            >
                <form id="payroll-form" onSubmit={submit} className="space-y-5">
                    <div>
                        <p className="mb-2 text-sm font-medium text-foreground">Pay schedule</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {(['daily', 'half_month', 'monthly'] as const).map((f) => (
                                <label key={f} className={cn('cursor-pointer rounded-xl border-2 p-3 transition-colors', data.frequency === f ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                                    <input type="radio" name="frequency" className="sr-only" checked={data.frequency === f} onChange={() => changeFrequency(f)} />
                                    <span className="block text-sm font-semibold text-foreground">{FREQUENCY_SHORT[f]}</span>
                                    <span className="block text-xs text-muted-foreground">{employee_counts[f] ?? 0} employee{(employee_counts[f] ?? 0) === 1 ? '' : 's'}</span>
                                </label>
                            ))}
                        </div>
                        {err.frequency && <p className="mt-1 text-xs text-error">{err.frequency}</p>}
                    </div>

                    {data.frequency === 'daily' ? (
                        <FormField label="Which day?" required error={err.anchor}><input type="date" value={data.anchor} max={today()} onChange={(e) => setData('anchor', e.target.value)} className={adminFieldClass(!!err.anchor)} /></FormField>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="Which month?" required error={err.anchor}><input type="month" value={data.anchor} onChange={(e) => setData('anchor', e.target.value)} className={adminFieldClass(!!err.anchor)} /></FormField>
                            {data.frequency === 'half_month' && (
                                <FormField label="Which half?" required error={err.half}>
                                    <select value={data.half} onChange={(e) => setData('half', e.target.value)} className={adminFieldClass(!!err.half)}>
                                        <option value="1">1st half (1st – {cutoff}th)</option>
                                        <option value="2">2nd half ({cutoff + 1}th – end of month)</option>
                                    </select>
                                </FormField>
                            )}
                        </div>
                    )}

                    {preview && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">Period: <b>{preview}</b></p>}
                    {notFinished && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">⏳ This period hasn't finished yet (it ends {new Date(`${periodEnd}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' })}). Create the payroll on or after that day so absences are counted correctly.</p>}
                    {eligible === 0 && <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">No active employees are paid {FREQUENCY_SHORT[data.frequency].toLowerCase()}. Change an employee's pay schedule on the Employees page first.</p>}

                    <FormField label="Notes" error={err.notes}><input value={data.notes} onChange={(e) => setData('notes', e.target.value)} placeholder="Optional" className={adminFieldClass()} /></FormField>
                </form>
            </CrudModal>

            <PayrollSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} canManage={can.manage} />
        </AdminLayout>
    );
}
