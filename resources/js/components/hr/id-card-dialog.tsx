import { Download, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRef } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { Button } from '@/components/ui/button';

interface Props {
    employee: { employee_code: string; full_name: string; position: string | null } | null;
    cafeName?: string;
    onClose: () => void;
}

/** The employee's ID card: their QR code is what they scan on the attendance screen. */
export function IdCardDialog({ employee, cafeName = 'Employee ID', onClose }: Props) {
    const cardRef = useRef<HTMLDivElement>(null);

    function print() {
        if (!cardRef.current) {
 return; 
}

        const win = window.open('', '_blank', 'width=420,height=560');

        if (!win) {
 return; 
}

        win.document.write(`<html><head><title>${employee?.employee_code}</title><style>
            body{font-family:'DM Sans',Arial,sans-serif;margin:0;display:flex;justify-content:center;padding:24px}
            .card{width:300px;border:2px solid #2C1A0E;border-radius:16px;padding:20px;text-align:center}
            .brand{font-size:13px;font-weight:700;letter-spacing:1px;color:#2C1A0E;text-transform:uppercase}
            .name{font-size:20px;font-weight:700;margin:12px 0 2px}.pos{color:#666;font-size:13px;margin-bottom:12px}
            .code{font-family:monospace;font-size:18px;font-weight:700;letter-spacing:2px;margin-top:10px}
            .hint{font-size:10px;color:#888;margin-top:8px}
        </style></head><body>${cardRef.current.innerHTML}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => {
 win.print(); win.close(); 
}, 250);
    }

    function download() {
        const svg = cardRef.current?.querySelector('svg');

        if (!svg || !employee) {
 return; 
}

        const xml = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
 return; 
}

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 600, 600);
            ctx.drawImage(img, 0, 0, 600, 600);
            const a = document.createElement('a');
            a.download = `${employee.employee_code}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
    }

    return (
        <CrudModal
            open={!!employee}
            onOpenChange={(open) => !open && onClose()}
            title="Employee ID card"
            description="Print this and give it to the employee. They scan the QR code on the attendance screen to clock in and out."
            className="max-w-sm"
            footer={
                <>
                    <Button variant="outline" className="flex-1" onClick={download}><Download className="h-4 w-4" /> QR image</Button>
                    <Button className="flex-1" onClick={print}><Printer className="h-4 w-4" /> Print card</Button>
                </>
            }
        >
            {employee && (
                <div ref={cardRef}>
                    <div className="card mx-auto w-full max-w-[300px] rounded-2xl border-2 border-primary p-5 text-center">
                        <div className="brand text-xs font-bold tracking-widest text-primary uppercase">{cafeName}</div>
                        <div className="mt-3 flex justify-center">
                            <QRCodeSVG value={employee.employee_code} size={190} level="M" marginSize={1} bgColor="#ffffff" fgColor="#000000" />
                        </div>
                        <div className="name mt-3 text-lg font-bold text-foreground">{employee.full_name}</div>
                        <div className="pos text-sm text-muted-foreground">{employee.position ?? '—'}</div>
                        <div className="code font-mono text-lg font-bold tracking-widest text-foreground">{employee.employee_code}</div>
                        <div className="hint mt-1 text-[10px] text-muted-foreground">Scan to clock in / out</div>
                    </div>
                </div>
            )}
        </CrudModal>
    );
}
