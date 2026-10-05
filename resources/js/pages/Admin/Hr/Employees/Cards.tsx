import { Head } from '@inertiajs/react';
import { Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
    employees: Array<{ id: number; code: string; name: string; position: string | null }>;
    cafe_name: string;
}

/** Every active employee's ID card on one printable sheet. */
export default function Cards({ employees, cafe_name }: Props) {
    return (
        <div className="min-h-screen bg-white p-6 text-black" style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>
            <Head title="Employee ID cards" />
            <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } .card { break-inside: avoid; } }`}</style>

            <div className="no-print mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Employee ID cards</h1>
                    <p className="text-sm text-gray-500">{employees.length} active employee{employees.length === 1 ? '' : 's'}. Print, cut and hand them out — each QR code is scanned on the attendance screen.</p>
                </div>
                <button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-lg bg-[#2C1A0E] px-4 text-sm font-semibold text-white"><Printer className="h-4 w-4" /> Print</button>
            </div>

            {employees.length === 0 ? (
                <p className="py-20 text-center text-gray-500">No active employees to print.</p>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {employees.map((e) => (
                        <div key={e.id} className="card rounded-2xl border-2 border-[#2C1A0E] p-4 text-center">
                            <p className="text-[11px] font-bold tracking-widest text-[#2C1A0E] uppercase">{cafe_name}</p>
                            <div className="mt-2 flex justify-center"><QRCodeSVG value={e.code} size={130} level="M" marginSize={1} /></div>
                            <p className="mt-2 text-base leading-tight font-bold">{e.name}</p>
                            <p className="text-xs text-gray-500">{e.position ?? '—'}</p>
                            <p className="mt-1 font-mono text-sm font-bold tracking-widest">{e.code}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
