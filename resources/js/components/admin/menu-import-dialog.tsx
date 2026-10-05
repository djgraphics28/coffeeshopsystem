import { router } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FolderPlus, Loader2, RefreshCw, SkipForward, UploadCloud, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CrudModal } from '@/components/admin/crud-modal';
import { Button } from '@/components/ui/button';
import { adminMenuItemsImport, adminMenuItemsImportTemplate } from '@/lib/routes';
import { cn } from '@/lib/utils';

type RowStatus = 'created' | 'updated' | 'skipped' | 'error';

interface ImportRow {
    row: number;
    category: string;
    name: string;
    new_category: boolean;
    status: RowStatus;
    messages: string[];
}

interface ImportReport {
    summary: {
        dry_run: boolean;
        total: number;
        created: number;
        updated: number;
        skipped: number;
        failed: number;
        categories_created: string[];
    };
    rows: ImportRow[];
}

type DuplicateMode = 'skip' | 'update';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const STATUS_STYLE: Record<RowStatus, { label: string; className: string }> = {
    created: { label: 'Will create', className: 'bg-success/10 text-success' },
    updated: { label: 'Will update', className: 'bg-info/10 text-info' },
    skipped: { label: 'Skip', className: 'bg-muted text-muted-foreground' },
    error: { label: 'Error', className: 'bg-error/10 text-error' },
};

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

export function MenuImportDialog({ open, onOpenChange }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<DuplicateMode>('skip');
    const [report, setReport] = useState<ImportReport | null>(null);
    const [busy, setBusy] = useState<'checking' | 'importing' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [onlyProblems, setOnlyProblems] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    function reset() {
        setFile(null); setReport(null); setError(null); setBusy(null); setMode('skip'); setOnlyProblems(false);
    }

    function pickFile(next: File | null) {
        setError(null);
        setReport(null);

        if (next && !/\.(xlsx|xls|csv)$/i.test(next.name)) {
            setFile(null);
            setError('Please choose an Excel file (.xlsx or .xls) or a .csv file.');

            return;
        }

        setFile(next);
    }

    async function send(dryRun: boolean): Promise<ImportReport | null> {
        if (!file) {
 return null; 
}

        const body = new FormData();
        body.append('file', file);
        body.append('duplicate_mode', mode);
        body.append('dry_run', dryRun ? '1' : '0');

        const res = await fetch(adminMenuItemsImport(), {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
            body,
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            const first = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;
            setError(first ?? data?.message ?? 'The file could not be processed. Please try again.');

            return null;
        }

        return res.json();
    }

    async function check() {
        setBusy('checking'); setError(null);

        try {
            setReport(await send(true));
        } catch {
            setError('Network problem — please check your connection and try again.');
        } finally {
            setBusy(null);
        }
    }

    async function runImport() {
        setBusy('importing'); setError(null);

        try {
            const result = await send(false);

            if (result) {
                const { created, updated, skipped, failed } = result.summary;
                toast.success(`Import complete: ${created} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}${failed ? `, ${failed} with errors` : ''}.`, { duration: 6000 });
                router.reload();
                onOpenChange(false);
                reset();
            }
        } catch {
            setError('Network problem — please check your connection and try again.');
        } finally {
            setBusy(null);
        }
    }

    const summary = report?.summary;
    const importable = summary ? summary.created + summary.updated : 0;
    const visibleRows = report ? (onlyProblems ? report.rows.filter((r) => r.status === 'error' || r.messages.length > 0) : report.rows) : [];

    return (
        <CrudModal
            open={open}
            onOpenChange={(next) => {
 onOpenChange(next);

 if (!next) {
 reset(); 
} 
}}
            title={<span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Import Menu Items from Excel</span>}
            description="Add or update many menu items at once. Nothing is saved until you confirm."
            className="max-w-3xl"
            footer={
                report ? (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:justify-between">
                        <Button variant="outline" onClick={() => setReport(null)} disabled={busy !== null}>
                            <RefreshCw className="h-4 w-4" /> Change file / options
                        </Button>
                        <Button onClick={runImport} disabled={importable === 0 || busy !== null}>
                            {busy === 'importing' ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : importable === 0 ? 'Nothing to import' : `Import ${importable} item${importable === 1 ? '' : 's'}`}
                        </Button>
                    </div>
                ) : (
                    <Button onClick={check} disabled={!file || busy !== null} className="w-full sm:w-auto">
                        {busy === 'checking' ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking file…</> : 'Check file'}
                    </Button>
                )
            }
        >
            {!report ? (
                <div className="space-y-6">
                    {/* Step 1 */}
                    <section className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">1</span>Download the template</h3>
                                <p className="mt-1 text-xs text-muted-foreground">It includes step-by-step instructions, example rows, dropdowns, and a list of your current categories and add-ons.</p>
                            </div>
                            <a href={adminMenuItemsImportTemplate()} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                                <Download className="h-4 w-4" /> Download template
                            </a>
                        </div>
                        <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                            <li className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />One menu item per row, starting at row 2</li>
                            <li className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /><span>Only <b className="font-semibold text-foreground">Category</b> and <b className="font-semibold text-foreground">Item Name</b> are always required</span></li>
                            <li className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /><span><b className="font-semibold text-foreground">Send to Kitchen</b>: Yes = Kitchen screen, No = Barista screen</span></li>
                            <li className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />New categories are created automatically</li>
                            <li className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />Sizes: fill Size 1–4 name + price, leave Price empty</li>
                        </ul>
                    </section>

                    {/* Step 2 */}
                    <section>
                        <h3 className="mb-2 text-sm font-semibold text-foreground"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">2</span>Upload your filled-in file</h3>
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => inputRef.current?.click()}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                            onDragOver={(e) => {
 e.preventDefault(); setDragging(true); 
}}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
 e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] ?? null); 
}}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                                dragging ? 'border-primary bg-primary/5' : file ? 'border-success/50 bg-success/5' : 'border-border hover:border-primary/50',
                            )}
                        >
                            {file ? (
                                <>
                                    <FileSpreadsheet className="h-8 w-8 text-success" />
                                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · click to choose a different file</p>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="h-8 w-8 text-primary" />
                                    <p className="text-sm font-semibold text-foreground">Click to choose a file, or drag it here</p>
                                    <p className="text-xs text-muted-foreground">.xlsx, .xls or .csv · up to 1,000 items · max 5 MB</p>
                                </>
                            )}
                            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
 pickFile(e.target.files?.[0] ?? null); e.target.value = ''; 
}} />
                        </div>

                        <fieldset className="mt-4">
                            <legend className="mb-2 text-xs font-medium text-muted-foreground">If an item already exists (same category and name)…</legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {([
                                    ['skip', 'Skip existing items', 'Safest. Existing items are left exactly as they are.'],
                                    ['update', 'Update existing items', 'Use the file to change prices, sizes, etc. Empty cells keep current values.'],
                                ] as const).map(([value, title, hint]) => (
                                    <label key={value} className={cn('flex cursor-pointer gap-2.5 rounded-xl border-2 p-3 transition-colors', mode === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                                        <input type="radio" name="duplicate_mode" value={value} checked={mode === value} onChange={() => {
 setMode(value); setReport(null); 
}} className="mt-0.5 accent-primary" />
                                        <span>
                                            <span className="block text-sm font-semibold text-foreground">{title}</span>
                                            <span className="block text-xs text-muted-foreground">{hint}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    </section>

                    {error && (
                        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">3</span>Review — {file?.name}</h3>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {([
                            ['Will be added', summary!.created, 'text-success', CheckCircle2],
                            ['Will be updated', summary!.updated, 'text-info', RefreshCw],
                            ['Skipped', summary!.skipped, 'text-muted-foreground', SkipForward],
                            ['Rows with errors', summary!.failed, 'text-error', AlertTriangle],
                        ] as const).map(([label, value, tone, Icon]) => (
                            <div key={label} className="rounded-xl border border-border bg-card p-3">
                                <Icon className={cn('mb-1 h-4 w-4', tone)} />
                                <p className={cn('text-xl font-bold', value > 0 ? tone : 'text-foreground')}>{value}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>

                    {summary!.categories_created.length > 0 && (
                        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                            <FolderPlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div>
                                <p className="font-medium text-foreground">{summary!.categories_created.length} new categor{summary!.categories_created.length === 1 ? 'y' : 'ies'} will be created</p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {summary!.categories_created.map((c) => <span key={c} className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">{c}</span>)}
                                </div>
                            </div>
                        </div>
                    )}

                    {summary!.failed > 0 && (
                        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                            <span>{summary!.failed} row{summary!.failed === 1 ? ' has' : 's have'} problems and will <b>not</b> be imported. You can import the valid rows now, or fix the file and upload it again.</span>
                        </div>
                    )}

                    {error && (
                        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
                        </div>
                    )}

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">Row-by-row results ({summary!.total} rows)</p>
                            {(summary!.failed > 0 || report.rows.some((r) => r.messages.length > 0)) && (
                                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                                    <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="accent-primary" /> Show only problems
                                </label>
                            )}
                        </div>
                        <div className="max-h-72 overflow-auto rounded-xl border border-border">
                            <table className="w-full min-w-[520px] text-left text-xs">
                                <thead className="sticky top-0 bg-muted text-muted-foreground">
                                    <tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">Result</th></tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {visibleRows.map((r) => (
                                        <tr key={r.row} className={r.status === 'error' ? 'bg-error/5' : undefined}>
                                            <td className="px-3 py-2 align-top font-mono text-muted-foreground">{r.row}</td>
                                            <td className="px-3 py-2 align-top">
                                                {r.category || <span className="text-muted-foreground">—</span>}
                                                {r.new_category && r.category && <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">NEW</span>}
                                            </td>
                                            <td className="px-3 py-2 align-top font-medium text-foreground">{r.name || <span className="text-muted-foreground">—</span>}</td>
                                            <td className="px-3 py-2 align-top">
                                                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLE[r.status].className)}>{STATUS_STYLE[r.status].label}</span>
                                                {r.messages.map((m, i) => <p key={i} className={cn('mt-1', r.status === 'error' ? 'text-error' : 'text-muted-foreground')}>{m}</p>)}
                                            </td>
                                        </tr>
                                    ))}
                                    {visibleRows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No problems found 🎉</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </CrudModal>
    );
}
