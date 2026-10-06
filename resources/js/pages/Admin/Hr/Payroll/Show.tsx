import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Download, Printer, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { hoursMinutes, money, STATUS_STYLE   } from '@/components/hr/types';
import type {PayrollRun, PayslipData} from '@/components/hr/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminHrAdjustmentsDestroy, adminHrPayroll, adminHrPayrollApprove, adminHrPayrollPay, adminHrPayrollPayslip, adminHrPayrollRecalculate, adminHrPayrollShow, adminHrPayslipAdjustments } from '@/lib/routes';
import { cn, localDateString } from '@/lib/utils';

interface Props {
    run: PayrollRun;
    payslips: PayslipData[];
    totals: { gross: number; deductions: number; net: number; incomplete: number };
    can: { manage: boolean };
    currency: string;
}

export default function PayrollShow({ run, payslips, totals, can, currency }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const [adjusting, setAdjusting] = useState<number | null>(null);
    const [confirm, setConfirm] = useState<'approve' | 'delete' | null>(null);
    const [payOpen, setPayOpen] = useState(false);
    const [payDate, setPayDate] = useState(localDateString());
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (flash?.success) {
 toast.success(flash.success); 
}

        if (flash?.error) {
 toast.error(flash.error, { duration: 7000 }); 
}
    }, [flash]);

    const draft = run.status === 'draft';
    const adjustingSlip = payslips.find((p) => p.id === adjusting) ?? null;
    const act = (fn: () => void) => {
 setBusy(true); fn(); 
};
    const options = { preserveScroll: true, onFinish: () => {
 setBusy(false); setConfirm(null); setPayOpen(false); 
} };

    function exportCsv() {
        const rows = [
            ['Code', 'Employee', 'Position', 'Days worked', 'Hours', 'Late (min)', 'Overtime (min)', 'Basic pay', 'Overtime pay', 'Allowances', 'Late deduction', 'Absence deduction', 'Other deductions', 'Gross', 'Net'],
            ...payslips.map((p) => [p.employee_code, p.employee_name, p.position ?? '', p.days_worked, (p.worked_minutes / 60).toFixed(2), p.late_minutes, p.overtime_minutes, p.basic_pay, p.overtime_pay, p.earnings, p.late_deduction, p.absence_deduction, p.other_deductions, p.gross_pay, p.net_pay]),
        ];
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `${run.reference}.csv`;
        a.click();
    }

    const cards = [
        { label: 'Employees', value: String(payslips.length), tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
        { label: 'Gross pay', value: money(currency, totals.gross), tone: 'bg-info/10 text-info' },
        { label: 'Deductions', value: money(currency, totals.deductions), tone: 'bg-error/10 text-error' },
        { label: 'Net pay', value: money(currency, totals.net), tone: 'bg-success/10 text-success' },
    ];

    return (
        <AdminLayout>
            <Head title={`${run.reference} — Payroll`} />
            <Toaster position="top-right" />

            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link href={adminHrPayroll()} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> All payrolls</Link>
                    <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold text-foreground sm:text-2xl">{run.label} <Badge variant={STATUS_STYLE[run.status].variant}>{STATUS_STYLE[run.status].label}</Badge></h1>
                    <p className="mt-1 text-sm text-muted-foreground"><span className="font-mono">{run.reference}</span> · paid {run.frequency.replace('_', '-')}{run.pay_date ? ` · paid on ${new Date(`${run.pay_date}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
                    {can.manage && draft && (
                        <>
                            <Button variant="outline" disabled={busy} onClick={() => act(() => router.post(adminHrPayrollRecalculate(run.id), {}, options))}><RefreshCw className="h-4 w-4" /> Recalculate</Button>
                            <Button variant="outline" className="text-error" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" /> Delete</Button>
                            <Button onClick={() => setConfirm('approve')}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                        </>
                    )}
                    {can.manage && run.status === 'approved' && <Button onClick={() => setPayOpen(true)}><Banknote className="h-4 w-4" /> Mark as paid</Button>}
                </div>
            </div>

            {totals.incomplete > 0 && draft && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                    <p className="text-foreground"><b>{totals.incomplete} attendance day{totals.incomplete === 1 ? ' has' : 's have'} no clock-out</b> and {totals.incomplete === 1 ? 'is' : 'are'} not paid. Fix {totals.incomplete === 1 ? 'it' : 'them'} on the Attendance page, then press <b>Recalculate</b>.</p>
                </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {cards.map(({ label, value, tone }) => (
                    <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={cn('mt-1 inline-block rounded-lg px-2 py-0.5 text-lg font-bold', tone)}>{value}</p>
                    </div>
                ))}
            </div>

            <TableCard>
                <TableScroll>
                    <Table className="min-w-[1080px]">
                        <TableHead>
                            <tr>{['Employee', 'Days', 'Hours', 'Late', 'OT', 'Basic', 'OT pay', 'Adjustments', 'Deductions', 'Gross', 'Net pay', ''].map((h) => <TableHeadCell key={h}>{h}</TableHeadCell>)}</tr>
                        </TableHead>
                        <TableBody>
                            {payslips.length === 0 ? <TableEmpty colSpan={12}>No payslips.</TableEmpty> : payslips.map((p) => {
                                const fixedDeductions = p.late_deduction + p.absence_deduction;

                                return (
                                    <TableRow key={p.id}>
                                        <TableCell>
                                            <p className="text-sm font-semibold text-foreground">{p.employee_name}</p>
                                            <p className="font-mono text-[11px] text-muted-foreground">{p.employee_code}{p.position ? ` · ${p.position}` : ''}</p>
                                            {p.incomplete_days > 0 && <p className="mt-0.5 text-[11px] font-semibold text-warning">{p.incomplete_days} day(s) without clock-out</p>}
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{p.days_worked}<span className="text-muted-foreground"> / {p.expected_days}</span>{p.absent_days > 0 && <span className="block text-[11px] text-warning">{p.absent_days} absent</span>}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{hoursMinutes(p.worked_minutes)}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{p.late_minutes ? `${p.late_minutes} min` : '—'}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{p.overtime_minutes ? hoursMinutes(p.overtime_minutes) : '—'}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">{money(currency, p.basic_pay)}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">{p.overtime_pay ? money(currency, p.overtime_pay) : '—'}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">{p.earnings ? <span className="text-success">+{money(currency, p.earnings)}</span> : '—'}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">{p.total_deductions ? <span className="text-error" title={`Late/absence ${money(currency, fixedDeductions)} · other ${money(currency, p.other_deductions)}`}>−{money(currency, p.total_deductions)}</span> : '—'}</TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">{money(currency, p.gross_pay)}</TableCell>
                                        <TableCell className="text-sm font-bold whitespace-nowrap text-primary">{money(currency, p.net_pay)}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {can.manage && draft && <button onClick={() => setAdjusting(p.id)} title="Add allowances or deductions" aria-label={`Adjust ${p.employee_name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><SlidersHorizontal className="h-4 w-4" /></button>}
                                                <a href={adminHrPayrollPayslip(run.id, p.id)} target="_blank" rel="noopener noreferrer" title="Print payslip" aria-label={`Print payslip for ${p.employee_name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Printer className="h-4 w-4" /></a>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableScroll>
            </TableCard>
            {draft && <p className="mt-3 text-xs text-muted-foreground">This is a draft: figures follow attendance and can still change. <b>Approve</b> to lock them, then <b>Mark as paid</b> once the money has been handed out.</p>}

            <AdjustmentsDialog payslip={adjustingSlip} currency={currency} onClose={() => setAdjusting(null)} />

            <ConfirmDialog
                open={confirm === 'approve'} onOpenChange={(o) => !o && setConfirm(null)} loading={busy} tone="default" confirmLabel="Approve payroll"
                title="Approve this payroll?" description="Figures and adjustments are locked. You can still mark it as paid afterwards."
                onConfirm={() => act(() => router.post(adminHrPayrollApprove(run.id), {}, options))}
            />
            <ConfirmDialog
                open={confirm === 'delete'} onOpenChange={(o) => !o && setConfirm(null)} loading={busy} confirmLabel="Delete draft"
                title="Delete this draft payroll?" description="All its payslips and adjustments are removed. Attendance is not affected."
                onConfirm={() => act(() => router.delete(adminHrPayrollShow(run.id), options))}
            />
            <CrudModal
                open={payOpen} onOpenChange={setPayOpen} title="Mark payroll as paid" className="max-w-sm"
                description={`Records that ${money(currency, totals.net)} has been paid out to ${payslips.length} employee${payslips.length === 1 ? '' : 's'}.`}
                footer={<Button onClick={() => act(() => router.post(adminHrPayrollPay(run.id), { pay_date: payDate }, options))} disabled={busy}><Banknote className="h-4 w-4" /> Confirm paid</Button>}
            >
                <FormField label="Date paid"><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={adminFieldClass()} /></FormField>
            </CrudModal>
        </AdminLayout>
    );
}

function AdjustmentsDialog({ payslip, currency, onClose }: { payslip: PayslipData | null; currency: string; onClose: () => void }) {
    const { data, setData, post, processing, errors, reset } = useForm({ type: 'earning', label: '', amount: '' });
    const err = errors as Record<string, string | undefined>;

    return (
        <CrudModal
            open={!!payslip}
            onOpenChange={(o) => {
 if (!o) {
 onClose(); reset(); 
} 
}}
            title={payslip ? `Adjustments — ${payslip.employee_name}` : 'Adjustments'}
            description="Add allowances, bonuses or holiday pay as earnings, and cash advances, SSS/PhilHealth and the like as deductions."
            className="max-w-lg"
        >
            {payslip && (
                <div className="space-y-5">
                    {payslip.adjustments.length > 0 && (
                        <ul className="divide-y divide-border rounded-xl border border-border">
                            {payslip.adjustments.map((a) => (
                                <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', a.type === 'earning' ? 'bg-success/10 text-success' : 'bg-error/10 text-error')}>{a.type === 'earning' ? 'Earning' : 'Deduction'}</span>
                                    <span className="min-w-0 flex-1 truncate text-foreground">{a.label}</span>
                                    <span className={cn('font-semibold', a.type === 'earning' ? 'text-success' : 'text-error')}>{a.type === 'earning' ? '+' : '−'}{money(currency, a.amount)}</span>
                                    <button onClick={() => router.delete(adminHrAdjustmentsDestroy(a.id), { preserveScroll: true })} aria-label={`Remove ${a.label}`} className="rounded-lg p-1 text-muted-foreground hover:bg-error/10 hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <form onSubmit={(e) => {
 e.preventDefault(); post(adminHrPayslipAdjustments(payslip.id), { preserveScroll: true, onSuccess: () => reset() }); 
}} className="space-y-3 rounded-xl bg-muted/40 p-4">
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                            {(['earning', 'deduction'] as const).map((t) => (
                                <button key={t} type="button" onClick={() => setData('type', t)} className={cn('h-9 rounded-md text-sm font-medium transition-all', data.type === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>{t === 'earning' ? '+ Earning' : '− Deduction'}</button>
                            ))}
                        </div>
                        <FormField label="Label" required error={err.label}><input value={data.label} onChange={(e) => setData('label', e.target.value)} placeholder={data.type === 'earning' ? 'e.g. Meal allowance' : 'e.g. Cash advance'} className={adminFieldClass(!!err.label)} /></FormField>
                        <FormField label={`Amount (${currency})`} required error={err.amount}><input type="number" min="0" step="0.01" inputMode="decimal" value={data.amount} onChange={(e) => setData('amount', e.target.value)} className={adminFieldClass(!!err.amount)} /></FormField>
                        <Button type="submit" disabled={processing} className="w-full">Add {data.type}</Button>
                    </form>
                    <p className="text-center text-xs text-muted-foreground">Net pay now: <b className="text-foreground">{money(currency, payslip.net_pay)}</b></p>
                </div>
            )}
        </CrudModal>
    );
}
