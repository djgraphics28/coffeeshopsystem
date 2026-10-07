import { Head, router } from '@inertiajs/react';
import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { TableCard, TableScroll, Table, TableHead, TableHeadCell, TableBody, TableRow, TableCell, TableEmpty } from '@/components/admin/data-table';
import { adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminReports } from '@/lib/routes';
import { cn } from '@/lib/utils';

type CellType = 'text' | 'money' | 'int' | 'percent' | 'date';
type Period = 'today' | 'week' | 'month' | 'last_month' | 'year' | 'custom';

interface Column { key: string; label: string; type: CellType; align?: 'right' }
interface SummaryCard { label: string; value: number | string; type: CellType }
type Row = Record<string, string | number | null>;

interface Props {
    catalog: Array<{ group: string; items: Array<{ key: string; title: string }> }>;
    report: { key: string; title: string; description: string; summary: SummaryCard[]; columns: Column[]; rows: Row[]; totals: Row | null };
    filters: { report: string; period: Period; from: string; to: string };
    range: { label: string; generated_at: string };
    currency: string;
    cafe_name: string;
}

const PERIODS: Array<{ id: Period; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'last_month', label: 'Last month' },
    { id: 'year', label: 'This year' },
];

export default function ReportsIndex({ catalog, report, filters, range, currency, cafe_name }: Props) {
    const [from, setFrom] = useState(filters.from);
    const [to, setTo] = useState(filters.to);
    const [customOpen, setCustomOpen] = useState(filters.period === 'custom');

    const formatters: Record<CellType, (v: string | number) => string> = {
        money: (v) => `${currency}${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        int: (v) => Number(v).toLocaleString('en-PH', { maximumFractionDigits: 1 }),
        percent: (v) => `${Number(v).toLocaleString('en-PH', { maximumFractionDigits: 1 })}%`,
        date: (v) => new Date(`${v}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        text: (v) => String(v),
    };

    const format = (value: string | number | null | undefined, type: CellType) => (value === null || value === undefined || value === '' ? '—' : formatters[type](value));

    function query(extra: Record<string, string> = {}) {
        return { report: filters.report, period: filters.period, ...(filters.period === 'custom' ? { from: filters.from, to: filters.to } : {}), ...extra };
    }

    function go(params: Record<string, string>) {
        router.get(adminReports(), params, { preserveScroll: true, preserveState: true, replace: true });
    }

    const exportUrl = `${adminReports()}?${new URLSearchParams({ ...query(), export: 'csv' }).toString()}`;

    return (
        <AdminLayout>
            <Head title="Reports" />
            <div className="print:hidden">
                <PageHeader title="Reports" breadcrumbs={[{ label: 'Reports' }]} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
                <aside className="print:hidden">
                    <label htmlFor="report-select" className="sr-only">Choose a report</label>
                    <select id="report-select" value={filters.report} onChange={(e) => go(query({ report: e.target.value }))} className={cn(adminFieldClass(), 'lg:hidden')}>
                        {catalog.map((group) => (
                            <optgroup key={group.group} label={group.group}>
                                {group.items.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <nav aria-label="Reports" className="hidden space-y-5 rounded-2xl border border-border bg-card p-3 shadow-sm lg:block">
                        {catalog.map((group) => (
                            <div key={group.group}>
                                <p className="mb-1 px-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">{group.group}</p>
                                <ul className="space-y-0.5">
                                    {group.items.map((item) => (
                                        <li key={item.key}>
                                            <button
                                                onClick={() => go(query({ report: item.key }))}
                                                aria-current={filters.report === item.key ? 'page' : undefined}
                                                className={cn('w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors', filters.report === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                                            >
                                                {item.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>

                <section className="min-w-0 space-y-5">
                    <div className="flex flex-col gap-3 print:hidden xl:flex-row xl:items-center xl:justify-between">
                        <div role="tablist" aria-label="Period" className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">
                            {PERIODS.map((p) => (
                                <button
                                    key={p.id} role="tab" aria-selected={filters.period === p.id && !customOpen}
                                    onClick={() => { setCustomOpen(false); go(query({ period: p.id })); }}
                                    className={cn('h-9 rounded-lg px-3 text-sm font-medium transition-all', filters.period === p.id && !customOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <button
                                role="tab" aria-selected={filters.period === 'custom' || customOpen} onClick={() => setCustomOpen((v) => !v)}
                                className={cn('h-9 rounded-lg px-3 text-sm font-medium transition-all', filters.period === 'custom' || customOpen ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                            >
                                Custom
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
                            <Button asChild><a href={exportUrl}><Download className="h-4 w-4" /> Export CSV</a></Button>
                        </div>
                    </div>

                    {customOpen && (
                        <form
                            onSubmit={(e) => { e.preventDefault(); go({ report: filters.report, period: 'custom', from, to }); }}
                            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 print:hidden"
                        >
                            <label className="text-xs text-muted-foreground">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={adminFieldClass()} /></label>
                            <label className="text-xs text-muted-foreground">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={adminFieldClass()} /></label>
                            <Button type="submit">Apply</Button>
                        </form>
                    )}

                    <div>
                        <p className="hidden text-sm text-muted-foreground print:block">{cafe_name}</p>
                        <h2 className="text-lg font-semibold text-foreground">{report.title}</h2>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{range.label} · generated {range.generated_at}</p>
                    </div>

                    {report.summary.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                            {report.summary.map((card) => (
                                <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                                    <p className="text-xs text-muted-foreground">{card.label}</p>
                                    <p className="mt-1 truncate text-xl font-bold text-foreground">{format(card.value, card.type)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <TableCard>
                        <TableScroll>
                            <Table>
                                <TableHead>
                                    <tr>
                                        {report.columns.map((col) => <TableHeadCell key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>{col.label}</TableHeadCell>)}
                                    </tr>
                                </TableHead>
                                <TableBody>
                                    {report.rows.length === 0 && <TableEmpty colSpan={report.columns.length}>No data for this period.</TableEmpty>}
                                    {report.rows.map((row, i) => (
                                        <TableRow key={i}>
                                            {report.columns.map((col) => (
                                                <TableCell key={col.key} className={cn(col.align === 'right' && 'text-right tabular-nums', col.type === 'text' && 'max-w-xs')}>
                                                    {format(row[col.key], col.type)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    {report.totals && report.rows.length > 0 && (
                                        <TableRow className="bg-muted/60 font-bold">
                                            {report.columns.map((col) => (
                                                <TableCell key={col.key} className={cn('font-bold', col.align === 'right' && 'text-right tabular-nums')}>
                                                    {report.totals && col.key in report.totals ? format(report.totals[col.key], col.type === 'date' ? 'text' : col.type) : ''}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableScroll>
                    </TableCard>
                </section>
            </div>
        </AdminLayout>
    );
}
