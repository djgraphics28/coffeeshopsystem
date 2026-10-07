import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle, CalendarClock, CheckCircle2, Clock, Database, DatabaseBackup, Download, HardDrive, History,
    Loader2, Lock, Play, RotateCcw, ShieldCheck, Trash2, Upload, XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { PageHeader } from '@/components/admin/page-header';
import { SecureConfirmDialog } from '@/components/admin/secure-confirm-dialog';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import {
    adminSystemBackupsDestroy, adminSystemBackupsDownload, adminSystemBackupsImport, adminSystemBackupsRestore,
    adminSystemBackupsStore, adminSystemDatabaseReset, adminSystemSeedersRun,
} from '@/lib/routes';
import { cn } from '@/lib/utils';

interface BackupFile { name: string; size: number; created_at: string }
interface SeederInfo { class: string; label: string; description: string; warning: string | null }
interface ActivityEntry { id: number; event: string; description: string; user_name: string | null; created_at: string }

interface Props {
    backups: BackupFile[];
    activity: ActivityEntry[];
    reset_preview: Record<string, number>;
    seeders: SeederInfo[];
    info: { database: string; driver: string; schedule: string; retention: string; encrypted: boolean };
    words: { reset: string; restore: string; seed: string };
    can: { manage_backups: boolean; restore: boolean; reset: boolean; seed: boolean };
}

class RequestError extends Error {
    constructor(message: string, public errors: Record<string, string[]> = {}) {
        super(message);
    }
}

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

async function request<T>(url: string, method: 'POST' | 'DELETE', body?: FormData | Record<string, unknown>): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await fetch(url, {
        method,
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf(), ...(isForm || !body ? {} : { 'Content-Type': 'application/json' }) },
        body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const first = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;

        throw new RequestError(first ?? data?.message ?? 'Something went wrong. Please try again.', data?.errors ?? {});
    }

    return data as T;
}

const formatSize = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const formatWhen = (iso: string) =>
    new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function timeAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

    if (mins < 1) {
 return 'just now'; 
}

    if (mins < 60) {
 return `${mins} min ago`; 
}

    if (mins < 1440) {
 return `${Math.floor(mins / 60)} h ago`; 
}

    return `${Math.floor(mins / 1440)} day${Math.floor(mins / 1440) === 1 ? '' : 's'} ago`;
}

const EVENT_STYLE: Record<string, string> = {
    'backup-created': 'bg-success/10 text-success',
    'backup-imported': 'bg-info/10 text-info',
    'backup-downloaded': 'bg-muted text-muted-foreground',
    'backup-deleted': 'bg-warning/10 text-warning',
    'database-restored': 'bg-info/10 text-info',
    'seeder-run': 'bg-info/10 text-info',
    'seeder-denied': 'bg-error/10 text-error',
    'database-reset': 'bg-error/10 text-error',
    'database-restore-denied': 'bg-error/10 text-error',
    'database-reset-denied': 'bg-error/10 text-error',
};

export default function System({ backups, activity, reset_preview: preview, seeders, info, words, can }: Props) {
    const [seeding, setSeeding] = useState<SeederInfo | null>(null);
    const [seedBusy, setSeedBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [deleting, setDeleting] = useState<BackupFile | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [restoring, setRestoring] = useState<BackupFile | null>(null);
    const [restoreBusy, setRestoreBusy] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetBusy, setResetBusy] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [now] = useState(() => Date.now());

    const refresh = () => router.reload({ only: ['backups', 'activity', 'reset_preview'] });
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const latest = backups[0];
    const stale = !latest || now - new Date(latest.created_at).getTime() > 36 * 3600 * 1000;

    async function createBackup() {
        setCreating(true);

        try {
            const res = await request<{ data: BackupFile }>(adminSystemBackupsStore(), 'POST');
            toast.success(`Backup created · ${formatSize(res.data.size)}`);
            refresh();
        } catch (e) {
            toast.error((e as Error).message, { duration: 8000 });
        } finally {
            setCreating(false);
        }
    }

    async function importBackup(file?: File) {
        if (!file) {
 return; 
}

        if (!file.name.toLowerCase().endsWith('.zip')) {
            toast.error('Choose the backup .zip file.');

            return;
        }

        setImporting(true);
        const body = new FormData();
        body.append('file', file);

        try {
            await request(adminSystemBackupsImport(), 'POST', body);
            toast.success('Backup uploaded. Restore it from the list whenever you are ready.', { duration: 6000 });
            refresh();
        } catch (e) {
            toast.error((e as Error).message, { duration: 8000 });
        } finally {
            setImporting(false);
        }
    }

    async function confirmDelete() {
        if (!deleting) {
 return; 
}

        setDeleteLoading(true);

        try {
            await request(adminSystemBackupsDestroy(deleting.name), 'DELETE');
            toast.success('Backup deleted');
            refresh();
        } catch (e) {
            toast.error((e as Error).message);
        } finally {
            setDeleteLoading(false);
            setDeleting(null);
        }
    }

    async function runRestore(password: string) {
        if (!restoring) {
 return; 
}

        setRestoreBusy(true);
        setPasswordError(null);

        try {
            const res = await request<{ safety_backup: string }>(adminSystemBackupsRestore(restoring.name), 'POST', { password, confirmation: words.restore });
            toast.success(`Backup restored. Your previous data was saved as ${res.safety_backup}. Signing you out…`, { duration: 8000 });
            // The restored database has its own sessions, so this one is gone.
            setTimeout(() => {
 window.location.href = '/login'; 
}, 2500);
        } catch (e) {
            if (e instanceof RequestError && e.errors.password) {
 setPasswordError(e.errors.password[0]); 
} else {
 toast.error((e as Error).message, { duration: 12000 }); 
}

            setRestoreBusy(false);
        }
    }

    async function runSeeder(password: string) {
        if (!seeding) {
            return;
        }

        setSeedBusy(true);
        setPasswordError(null);

        try {
            const res = await request<{ message: string }>(adminSystemSeedersRun(), 'POST', { seeder: seeding.class, password, confirmation: words.seed });
            setSeeding(null);
            toast.success(res.message);
            refresh();
        } catch (e) {
            if (e instanceof RequestError && e.errors.password) {
                setPasswordError(e.errors.password[0]);
            } else {
                toast.error((e as Error).message, { duration: 12000 });
            }
        } finally {
            setSeedBusy(false);
        }
    }

    async function runReset(password: string) {
        setResetBusy(true);
        setPasswordError(null);

        try {
            const res = await request<{ backup: string; tables_cleared: number; users_removed: number }>(adminSystemDatabaseReset(), 'POST', { password, confirmation: words.reset });
            setResetOpen(false);
            toast.success(`Database reset. ${res.tables_cleared} tables cleared, ${res.users_removed} other account${res.users_removed === 1 ? '' : 's'} removed. A backup was saved first (${res.backup}).`, { duration: 10000 });
            refresh();
        } catch (e) {
            if (e instanceof RequestError && e.errors.password) {
 setPasswordError(e.errors.password[0]); 
} else {
 toast.error((e as Error).message, { duration: 12000 }); 
}
        } finally {
            setResetBusy(false);
        }
    }

    const summary = [
        { icon: Database, label: 'Database', value: info.database, hint: info.driver.toUpperCase(), tone: 'text-primary bg-primary/10' },
        { icon: HardDrive, label: 'Backups stored', value: String(backups.length), hint: backups.length ? formatSize(totalSize) : 'none yet', tone: 'text-info bg-info/10' },
        { icon: Clock, label: 'Last backup', value: latest ? timeAgo(latest.created_at) : 'Never', hint: latest ? formatWhen(latest.created_at) : 'create one now', tone: stale ? 'text-warning bg-warning/10' : 'text-success bg-success/10' },
        { icon: CalendarClock, label: 'Automatic backup', value: 'Daily 1:30 AM', hint: 'needs the scheduler running', tone: 'text-brand-600 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300' },
    ];

    return (
        <AdminLayout>
            <Head title="System" />
            <Toaster position="top-right" />

            <PageHeader
                title="System"
                breadcrumbs={[{ label: 'System' }]}
                actions={can.manage_backups && (
                    <>
                        <input ref={fileInput} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => {
 importBackup(e.target.files?.[0]); e.target.value = ''; 
}} />
                        <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={importing || creating}>
                            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload backup
                        </Button>
                        <Button onClick={createBackup} disabled={creating || importing}>
                            {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <><DatabaseBackup className="h-4 w-4" /> Back up now</>}
                        </Button>
                    </>
                )}
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">Back up, restore and reset the database. Only administrators can see this page.</p>

            {stale && can.manage_backups && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                    <p className="text-foreground">{latest ? 'The last backup is more than a day and a half old.' : 'There is no backup yet.'} Click <b>Back up now</b> to protect your data.</p>
                </div>
            )}

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summary.map(({ icon: Icon, label, value, hint, tone }) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="h-5 w-5" /></span>
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="truncate text-base font-bold text-foreground">{value}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Backups */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><ShieldCheck className="h-5 w-5 text-primary" /> Database backups</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Each backup is a compressed copy of the database (orders, menu, customers, settings, accounts). Pictures are not included. {info.retention}.
                            {info.encrypted && <span className="ml-1 inline-flex items-center gap-1 font-medium text-success"><Lock className="h-3 w-3" /> Encrypted</span>}
                        </p>
                    </div>
                </header>

                {backups.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-14 text-center text-muted-foreground">
                        <DatabaseBackup className="mb-3 h-12 w-12 opacity-20" />
                        <p className="text-sm font-medium text-foreground">No backups yet</p>
                        <p className="mt-1 text-xs">Create your first backup, or upload one made on another machine.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="bg-muted/40 text-xs text-muted-foreground">
                                <tr><th className="px-5 py-2.5 font-medium">Backup</th><th className="px-3 py-2.5 font-medium">Created</th><th className="px-3 py-2.5 font-medium">Size</th><th className="px-5 py-2.5 text-right font-medium">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {backups.map((b, i) => (
                                    <tr key={b.name} className="hover:bg-muted/30">
                                        <td className="px-5 py-3">
                                            <p className="font-mono text-xs font-semibold text-foreground">{b.name}</p>
                                            {i === 0 && <span className="mt-1 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Latest</span>}
                                            {b.name.startsWith('imported-') && <span className="mt-1 ml-1 inline-block rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">Uploaded</span>}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatWhen(b.created_at)}<span className="block text-[11px] opacity-70">{timeAgo(b.created_at)}</span></td>
                                        <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">{formatSize(b.size)}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {can.manage_backups && <a href={adminSystemBackupsDownload(b.name)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Download this backup"><Download className="h-3.5 w-3.5" /> Download</a>}
                                                {can.restore && <button onClick={() => {
 setPasswordError(null); setRestoring(b); 
}} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-info transition-colors hover:bg-info/10" title="Replace the database with this backup"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>}
                                                {can.manage_backups && <button onClick={() => setDeleting(b)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-error/10 hover:text-error" aria-label={`Delete ${b.name}`} title="Delete this backup"><Trash2 className="h-3.5 w-3.5" /></button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Activity */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <header className="border-b border-border px-5 py-4">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><History className="h-5 w-5 text-primary" /> Recent activity</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">A record of who backed up, restored or reset the database.</p>
                </header>
                {activity.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {activity.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                                <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', EVENT_STYLE[a.event] ?? 'bg-muted text-muted-foreground')}>{a.event.replace(/-/g, ' ')}</span>
                                <span className="min-w-0 flex-1 text-foreground">{a.description}</span>
                                <span className="text-xs whitespace-nowrap text-muted-foreground">{a.user_name ?? 'System'} · {formatWhen(a.created_at)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {can.seed && (
            <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <header className="border-b border-border px-5 py-4">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><Play className="h-5 w-5 text-primary" /> Run seeders</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Adds default data without opening a terminal. Seeders only add what is missing; your existing records are not deleted. You will be asked for your password.</p>
                </header>
                <ul className="divide-y divide-border">
                    {seeders.map((seeder) => (
                        <li key={seeder.class} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">{seeder.label} <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{seeder.class}</span></p>
                                <p className="text-xs text-muted-foreground">{seeder.description}</p>
                                {seeder.warning && <p className="mt-1 flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {seeder.warning}</p>}
                            </div>
                            <Button variant="secondary" onClick={() => { setPasswordError(null); setSeeding(seeder); }}><Play className="h-4 w-4" /> Run</Button>
                        </li>
                    ))}
                </ul>
            </section>
            )}

            {/* Danger zone */}
            {can.reset && (
            <section className="overflow-hidden rounded-2xl border-2 border-error/30 bg-card shadow-sm">
                <header className="border-b border-error/20 bg-error/5 px-5 py-4">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-error"><AlertTriangle className="h-5 w-5" /> Danger zone — reset the database</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">Starts the system fresh. A backup is taken automatically first, so you can still undo it by restoring that backup.</p>
                </header>
                <div className="grid gap-5 p-5 md:grid-cols-2">
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Kept</p>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                            <li>• Roles and permissions</li>
                            <li>• The admin account(s) and their roles</li>
                            <li>• System settings are set back to defaults (re-seeded)</li>
                        </ul>
                    </div>
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground"><XCircle className="h-4 w-4 text-error" /> Permanently deleted</p>
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                            {([['orders', 'Orders'], ['payments', 'Payments'], ['menu_items', 'Menu items'], ['categories', 'Categories'], ['customers', 'Customers'], ['expenses', 'Expenses'], ['promos', 'Promos'], ['tables', 'Tables'], ['staff_accounts', 'Other staff accounts']] as const).map(([key, label]) => (
                                <li key={key}>• <b className="text-foreground">{preview[key] ?? 0}</b> {label.toLowerCase()}</li>
                            ))}
                            <li className="col-span-2">• Uploaded pictures and everything else not listed under “Kept”</li>
                        </ul>
                    </div>
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-error/20 bg-muted/30 px-5 py-4">
                    <p className="text-xs text-muted-foreground">You will be asked for your password and to type <span className="font-mono font-semibold">{words.reset}</span>.</p>
                    <Button variant="destructive" onClick={() => {
 setPasswordError(null); setResetOpen(true); 
}}><AlertTriangle className="h-4 w-4" /> Reset database…</Button>
                </footer>
            </section>
            )}

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title="Delete this backup?"
                description={deleting ? `${deleting.name} will be removed permanently.` : undefined}
                confirmLabel="Delete"
            />

            <SecureConfirmDialog
                open={!!restoring}
                onOpenChange={(open) => !open && setRestoring(null)}
                title="Restore this backup?"
                word={words.restore}
                confirmLabel="Restore backup"
                loading={restoreBusy}
                passwordError={passwordError}
                onConfirm={runRestore}
            >
                {restoring && (
                    <>
                        <p>Everything in the database right now will be <b className="text-foreground">replaced</b> with the contents of <span className="font-mono text-xs text-foreground">{restoring.name}</span> ({formatWhen(restoring.created_at)}).</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>Orders, menu, customers and accounts go back to how they were at that time.</li>
                            <li>A safety backup of the current data is made first.</li>
                            <li>You will be signed out and must sign in again with an account from the backup.</li>
                        </ul>
                    </>
                )}
            </SecureConfirmDialog>

            <SecureConfirmDialog
                open={!!seeding}
                onOpenChange={(open) => !open && setSeeding(null)}
                title={seeding ? `Run the ${seeding.label} seeder?` : 'Run seeder'}
                word={words.seed}
                confirmLabel="Run seeder"
                loading={seedBusy}
                passwordError={passwordError}
                onConfirm={runSeeder}
            >
                {seeding && (
                    <>
                        <p>{seeding.description}</p>
                        {seeding.warning && <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{seeding.warning}</p>}
                    </>
                )}
            </SecureConfirmDialog>

            <SecureConfirmDialog
                open={resetOpen}
                onOpenChange={setResetOpen}
                title="Reset the database?"
                word={words.reset}
                confirmLabel="Reset database"
                loading={resetBusy}
                passwordError={passwordError}
                onConfirm={runReset}
            >
                <p>This permanently deletes <b className="text-foreground">all orders, payments, menu items, categories, customers, expenses, promos, tables, other staff accounts and uploaded pictures</b>.</p>
                <p>Kept: roles and permissions, the admin account(s), and the system settings (reset to their defaults).</p>
                <p className="rounded-lg bg-muted px-3 py-2 text-xs">A backup is saved automatically right before the reset. If that backup fails, nothing is deleted.</p>
            </SecureConfirmDialog>
        </AdminLayout>
    );
}
