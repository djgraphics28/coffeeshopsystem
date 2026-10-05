import { Head, useForm } from '@inertiajs/react';
import { adminTablesDestroy, adminTablesRegenerateQr, adminTablesStore, adminTablesUpdate } from '@/lib/routes';
import { Download, Edit2, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';
import { PageHeader } from '@/components/admin/page-header';
import { CrudModal } from '@/components/admin/crud-modal';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Table {
    id: number;
    name: string;
    qr_token: string;
    is_active: boolean;
    sort_order: number;
}

interface Props {
    tables: Table[];
    base_url: string;
}

export default function TablesIndex({ tables, base_url }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Table | null>(null);
    const [qrPreview, setQrPreview] = useState<Table | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleting, setDeleting] = useState<Table | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [regenTarget, setRegenTarget] = useState<Table | null>(null);
    const [regenLoading, setRegenLoading] = useState(false);

    function toggleSelect(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function toggleSelectAll() {
        if (selectedIds.size === tables.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(tables.map((t) => t.id)));
        }
    }

    function printSelected() {
        if (selectedIds.size === 0) {
            toast.error('Select at least one table to print.');
            return;
        }
        window.print();
    }

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        is_active: true as boolean,
        sort_order: 0,
    });

    function qrUrl(table: Table) {
        return `${base_url}/order/${table.qr_token}`;
    }

    function downloadQr(table: Table) {
        const svg = document.getElementById(`qr-${table.id}`) as unknown as SVGSVGElement;
        if (!svg) return;
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(svg);
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d')!;
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, 300, 300);
            const a = document.createElement('a');
            a.download = `qr-${table.name.replace(/\s+/g, '-')}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    }

    function openCreate() {
        reset();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(table: Table) {
        setEditing(table);
        setData({ name: table.name, is_active: table.is_active, sort_order: table.sort_order });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (editing) {
            put(adminTablesUpdate(editing.id), { onSuccess: () => { setModalOpen(false); toast.success('Table updated!'); } });
        } else {
            post(adminTablesStore(), { onSuccess: () => { setModalOpen(false); toast.success('Table created!'); } });
        }
    }

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    function confirmDelete() {
        if (!deleting) return;
        setDeleteLoading(true);
        fetch(adminTablesDestroy(deleting.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload());
    }

    function confirmRegenerate() {
        if (!regenTarget) return;
        setRegenLoading(true);
        fetch(adminTablesRegenerateQr(regenTarget.id), { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => {
            toast.success('QR regenerated!');
            window.location.reload();
        });
    }

    return (
        <AdminLayout>
            <Head title="Tables & QR — Admin" />
            <Toaster position="top-right" />

            {/* Screen-only content */}
            <div className="print:hidden">
                <PageHeader
                    title="Tables & QR Codes"
                    breadcrumbs={[{ label: 'Tables & QR' }]}
                    actions={
                        <>
                            {selectedIds.size > 0 && (
                                <Button onClick={printSelected}>
                                    <Printer className="h-4 w-4" /> Print Selected ({selectedIds.size})
                                </Button>
                            )}
                            <Button variant="outline" onClick={toggleSelectAll}>
                                {selectedIds.size === tables.length && tables.length > 0 ? 'Deselect All' : 'Select All'}
                            </Button>
                            <Button onClick={openCreate}>
                                <Plus className="h-4 w-4" /> Add Table
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tables.map((table) => {
                        const isSelected = selectedIds.has(table.id);
                        return (
                            <div
                                key={table.id}
                                className={cn(
                                    'cursor-pointer rounded-2xl border bg-card p-4 shadow-sm transition-all',
                                    isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                                )}
                                onClick={() => toggleSelect(table.id)}
                            >
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(table.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                                        />
                                        <div>
                                            <p className="font-semibold text-foreground">{table.name}</p>
                                            <Badge variant={table.is_active ? 'success' : 'neutral'} className="mt-1">
                                                {table.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => openEdit(table)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"><Edit2 className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setDeleting(table)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>

                                {/* QR Code */}
                                <div className="flex justify-center rounded-xl bg-white p-3">
                                    <QRCodeSVGWithId id={`qr-${table.id}`} value={qrUrl(table)} size={120} />
                                </div>

                                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => setQrPreview(table)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-muted py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70">
                                        Preview
                                    </button>
                                    <button onClick={() => downloadQr(table)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-muted py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/70">
                                        <Download className="h-3.5 w-3.5" /> Download
                                    </button>
                                    <button onClick={() => setRegenTarget(table)} className="rounded-xl bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-muted/70">
                                        <RefreshCw className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Print-only A4 portrait layout — 3 columns */}
            <div className="hidden print:block">
                <style>{`
                    @media print {
                        @page { size: A4 portrait; margin: 15mm; }
                        body * { visibility: hidden; }
                        .print-sheet, .print-sheet * { visibility: visible; }
                        .print-sheet { position: absolute; inset: 0; }
                    }
                `}</style>
                <div className="print-sheet">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12mm', width: '100%' }}>
                        {tables.filter((t) => selectedIds.has(t.id)).map((table) => (
                            <div key={table.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center', breakInside: 'avoid' }}>
                                <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '14px', color: '#2C1A0E', marginBottom: '8px' }}>{table.name}</p>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                    <QRCodeSVG value={qrUrl(table)} size={140} bgColor="#ffffff" fgColor="#2C1A0E" />
                                </div>
                                <p style={{ fontSize: '9px', color: '#9ca3af', wordBreak: 'break-all' }}>{qrUrl(table)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table Form Modal */}
            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Table' : 'New Table'}
                className="max-w-sm"
                footer={
                    <Button type="submit" form="table-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Table'}
                    </Button>
                }
            >
                <form id="table-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Table Name" required error={errors.name}>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className={adminFieldClass(!!errors.name)} placeholder="e.g., Table 1" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Sort Order">
                            <input type="number" value={data.sort_order} onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)} className={adminFieldClass()} />
                        </FormField>
                        <div className="flex items-end pb-2.5">
                            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
                                Active
                            </label>
                        </div>
                    </div>
                </form>
            </CrudModal>

            {/* QR Preview Modal */}
            <CrudModal
                open={!!qrPreview}
                onOpenChange={(open) => !open && setQrPreview(null)}
                title="Table QR Code"
                className="max-w-xs"
                footer={
                    <Button className="w-full" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" /> Print QR
                    </Button>
                }
            >
                {qrPreview && (
                    <div className="text-center">
                        <p className="mb-1 text-xs text-muted-foreground">Scan to order at</p>
                        <p className="mb-4 text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{qrPreview.name}</p>
                        <div className="flex justify-center rounded-2xl bg-white p-4">
                            <QRCodeSVG value={qrUrl(qrPreview)} size={180} bgColor="#ffffff" fgColor="#2C1A0E" />
                        </div>
                        <p className="mt-3 text-xs break-all text-muted-foreground">{qrUrl(qrPreview)}</p>
                    </div>
                )}
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
                title="Delete table?"
                description={deleting ? `"${deleting.name}" will be permanently removed.` : undefined}
                confirmLabel="Delete"
            />

            <ConfirmDialog
                open={!!regenTarget}
                onOpenChange={(open) => !open && setRegenTarget(null)}
                onConfirm={confirmRegenerate}
                loading={regenLoading}
                tone="default"
                title="Regenerate QR code?"
                description="The old QR code will no longer work."
                confirmLabel="Regenerate"
            />
        </AdminLayout>
    );
}

function QRCodeSVGWithId({ id, value, size }: { id: string; value: string; size: number }) {
    return <QRCodeSVG id={id} value={value} size={size} bgColor="#ffffff" fgColor="#2C1A0E" />;
}
