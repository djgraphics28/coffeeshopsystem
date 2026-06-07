import { Head, useForm } from '@inertiajs/react';
import { adminTablesDestroy, adminTablesRegenerateQr, adminTablesStore, adminTablesUpdate } from '@/lib/routes';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Edit2, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

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
    const qrRef = useRef<SVGSVGElement | null>(null);

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

    async function regenerateQr(table: Table) {
        if (!confirm('Regenerate QR code? The old QR will no longer work.')) return;
        await fetch(adminTablesRegenerateQr(table.id), { method: 'POST', headers: { 'X-CSRF-TOKEN': csrf() } });
        toast.success('QR regenerated!');
        window.location.reload();
    }

    return (
        <AdminLayout>
            <Head title="Tables & QR — Admin" />
            <Toaster position="top-right" />

            {/* Screen-only content */}
            <div className="p-6 print:hidden">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Tables & QR Codes</h1>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <button onClick={printSelected} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                <Printer className="h-4 w-4" /> Print Selected ({selectedIds.size})
                            </button>
                        )}
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--ap-border)', color: 'var(--ap-input-text)', background: 'var(--ap-card)' }}>
                            {selectedIds.size === tables.length && tables.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                        <button onClick={openCreate} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                            <Plus className="h-4 w-4" /> Add Table
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {tables.map((table) => {
                        const isSelected = selectedIds.has(table.id);
                        return (
                            <div
                                key={table.id}
                                className={`cursor-pointer rounded-2xl bg-white p-4 shadow-sm transition-all ${isSelected ? 'ring-2' : 'ring-1 ring-transparent'}`}
                                style={{ border: '1px solid var(--ap-border)', ...(isSelected ? { outline: '2px solid #D4A843' } : {}) }}
                                onClick={() => toggleSelect(table.id)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(table.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-0.5 h-4 w-4 rounded accent-yellow-500"
                                        />
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--ap-input-text)' }}>{table.name}</p>
                                            <span className={`mt-1 rounded-full px-2 py-0.5 text-xs ${table.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {table.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => openEdit(table)} className="rounded-lg p-1.5 hover:bg-gray-100"><Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} /></button>
                                        <button onClick={() => { if (confirm('Delete table?')) { fetch(adminTablesDestroy(table.id), { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrf() } }).then(() => window.location.reload()); } }} className="rounded-lg p-1.5 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
                                    </div>
                                </div>

                                {/* QR Code */}
                                <div className="flex justify-center rounded-xl p-3" style={{ background: '#ffffff' }}>
                                    <QRCodeSVGWithId id={`qr-${table.id}`} value={qrUrl(table)} size={120} />
                                </div>

                                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => setQrPreview(table)} className="flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-medium" style={{ background: 'var(--ap-bg)', color: 'var(--ap-input-text)' }}>
                                        Preview
                                    </button>
                                    <button onClick={() => downloadQr(table)} className="flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-medium" style={{ background: 'var(--ap-bg)', color: 'var(--ap-input-text)' }}>
                                        <Download className="h-3.5 w-3.5" /> Download
                                    </button>
                                    <button onClick={() => regenerateQr(table)} className="rounded-xl p-1.5" style={{ background: 'var(--ap-bg)' }}>
                                        <RefreshCw className="h-3.5 w-3.5" style={{ color: 'var(--ap-muted)' }} />
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
            <AnimatePresence>
                {modalOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40" style={{ zIndex: 50 }} onClick={() => setModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl" style={{ zIndex: 60 }}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-lg" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{editing ? 'Edit Table' : 'New Table'}</h2>
                                <button onClick={() => setModalOpen(false)}><X className="h-5 w-5" style={{ color: 'var(--ap-muted)' }} /></button>
                            </div>
                            <form onSubmit={submit} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Table Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="e.g., Table 1" />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Sort Order</label>
                                        <input type="number" value={data.sort_order} onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                    </div>
                                    <div className="flex flex-col justify-end pb-0.5">
                                        <label className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>
                                            <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} />
                                            Active
                                        </label>
                                    </div>
                                </div>
                                <button type="submit" disabled={processing} className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                                    {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Table'}
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* QR Preview Modal */}
            <AnimatePresence>
                {qrPreview && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60" style={{ zIndex: 50 }} onClick={() => setQrPreview(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-8 shadow-2xl text-center" style={{ zIndex: 60 }}>
                            <p className="mb-1 text-xs" style={{ color: 'var(--ap-muted)' }}>Scan to order at</p>
                            <p className="mb-4 font-bold text-xl" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>{qrPreview.name}</p>
                            <div className="flex justify-center rounded-2xl p-4" style={{ background: '#ffffff' }}>
                                <QRCodeSVG value={qrUrl(qrPreview)} size={180} bgColor="#ffffff" fgColor="#2C1A0E" />
                            </div>
                            <p className="mt-3 text-xs break-all" style={{ color: 'var(--ap-muted)' }}>{qrUrl(qrPreview)}</p>
                            <button onClick={() => window.print()} className="mt-4 w-full rounded-full py-2.5 text-sm font-bold" style={{ background: '#2C1A0E', color: '#D4A843' }}>
                                🖨 Print QR
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AdminLayout>
    );
}

function QRCodeSVGWithId({ id, value, size }: { id: string; value: string; size: number }) {
    return <QRCodeSVG id={id} value={value} size={size} bgColor="#ffffff" fgColor="#2C1A0E" />;
}
