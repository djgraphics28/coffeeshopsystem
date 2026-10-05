import { Head } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { hoursMinutes, money   } from '@/components/hr/types';
import type {PayrollRun, PayslipData} from '@/components/hr/types';

interface Props {
    run: PayrollRun;
    payslip: PayslipData;
    cafe_name: string;
    currency: string;
}

function Row({ currency, label, value, bold }: { currency: string; label: string; value: number; bold?: boolean }) {
    return (
        <div className={`flex justify-between gap-4 py-1.5 text-sm ${bold ? 'border-t border-black font-bold' : ''}`}><span>{label}</span><span className="tabular-nums">{money(currency, value)}</span></div>
    );
}

/** A single payslip laid out for A4 / letter printing. */
export default function Payslip({ run, payslip: p, cafe_name, currency }: Props) {
    const earnings: Array<[string, number]> = [
        [`Basic pay${p.salary_type === 'daily' ? ` (${p.days_worked} day${p.days_worked === 1 ? '' : 's'} × ${money(currency, p.daily_rate)})` : ''}`, p.basic_pay],
        ...(p.overtime_pay ? [[`Overtime (${hoursMinutes(p.overtime_minutes)})`, p.overtime_pay] as [string, number]] : []),
        ...p.adjustments.filter((a) => a.type === 'earning').map((a) => [a.label, a.amount] as [string, number]),
    ];
    const deductions: Array<[string, number]> = [
        ...(p.late_deduction ? [[`Late (${p.late_minutes} min)`, p.late_deduction] as [string, number]] : []),
        ...(p.absence_deduction ? [[`Absences (${p.absent_days} day${p.absent_days === 1 ? '' : 's'})`, p.absence_deduction] as [string, number]] : []),
        ...p.adjustments.filter((a) => a.type === 'deduction').map((a) => [a.label, a.amount] as [string, number]),
    ];

    return (
        <div className="min-h-screen bg-gray-100 p-6 text-black print:bg-white print:p-0" style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
            <Head title={`Payslip — ${p.employee_name}`} />
            <style>{'@media print { .no-print { display: none !important; } @page { margin: 14mm; } }'}</style>

            <div className="no-print mx-auto mb-4 flex max-w-2xl justify-end">
                <button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C1A0E] px-4 text-sm font-semibold text-white"><Printer className="h-4 w-4" /> Print</button>
            </div>

            <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow print:shadow-none">
                <div className="flex items-start justify-between border-b-2 border-black pb-4">
                    <div><p className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{cafe_name}</p><p className="text-xs text-gray-500">PAYSLIP</p></div>
                    <div className="text-right text-sm"><p className="font-semibold">{run.label}</p><p className="font-mono text-xs text-gray-500">{run.reference}</p></div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 text-sm">
                    <div><p className="text-xs text-gray-500">Employee</p><p className="font-semibold">{p.employee_name}</p><p className="font-mono text-xs text-gray-500">{p.employee_code}</p></div>
                    <div><p className="text-xs text-gray-500">Position</p><p className="font-semibold">{p.position ?? '—'}</p></div>
                    <div><p className="text-xs text-gray-500">Days worked</p><p className="font-semibold">{p.days_worked} of {p.expected_days}</p></div>
                    <div><p className="text-xs text-gray-500">Hours worked</p><p className="font-semibold">{hoursMinutes(p.worked_minutes)}</p></div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                    <div><h2 className="mb-1 border-b border-gray-300 pb-1 text-xs font-bold tracking-widest uppercase">Earnings</h2>
                        {earnings.map(([l, v], i) => <Row key={i} currency={currency} label={l} value={v} />)}
                        <Row currency={currency} label="Gross pay" value={p.gross_pay} bold />
                    </div>
                    <div><h2 className="mb-1 border-b border-gray-300 pb-1 text-xs font-bold tracking-widest uppercase">Deductions</h2>
                        {deductions.length === 0 ? <p className="py-1.5 text-sm text-gray-400">None</p> : deductions.map(([l, v], i) => <Row key={i} currency={currency} label={l} value={v} />)}
                        <Row currency={currency} label="Total deductions" value={p.total_deductions} bold />
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-lg bg-[#2C1A0E] px-5 py-4 text-white">
                    <span className="text-sm font-semibold tracking-widest uppercase">Net pay</span>
                    <span className="text-2xl font-bold tabular-nums">{money(currency, p.net_pay)}</span>
                </div>

                <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-gray-500">
                    <div className="border-t border-black pt-1">Prepared by</div>
                    <div className="border-t border-black pt-1">Received by — {p.employee_name}</div>
                </div>
            </div>
        </div>
    );
}
