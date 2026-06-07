export interface ReceiptOrder {
    order_number: string;
    type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    table?: { name: string } | null;
    items: Array<{
        menu_item: { name: string };
        quantity: number;
        subtotal: number;
        addons?: Array<{ name: string }>;
    }>;
    payment?: { method: string; amount: number; reference_no?: string | null } | null;
    created_at: string;
    /** Cash-payment extras (POS only) */
    cashReceived?: number;
    change?: number;
    payMethod?: string;
}

export function printReceipt(el: HTMLElement) {
    const win = window.open('', '_blank', 'width=420,height=720');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Courier New',Courier,monospace; font-size:12px; color:#000; background:#fff; width:302px; }
            .receipt { padding:8px 10px; }
            @media print { @page { margin:0; size:80mm auto; } }
        </style>
    </head><body><div class="receipt">${el.innerHTML}</div>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
    </body></html>`);
    win.document.close();
}

export function ThermalReceipt({ order, currency = '₱' }: { order: ReceiptOrder; currency?: string }) {
    const created = new Date(order.created_at || Date.now());
    const date = created.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
    const time = created.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    const payMethod = (order.payMethod ?? order.payment?.method ?? 'N/A').toUpperCase();
    const cashReceived = order.cashReceived ?? order.payment?.amount;
    const change = order.change;

    const s: React.CSSProperties = { fontFamily: "'Courier New',Courier,monospace", fontSize: 12, color: '#000', lineHeight: 1.55 };
    const row = (label: string, value: string, bold = false): React.ReactNode => (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: bold ? 'bold' : 'normal' }}>
            <span>{label}</span><span>{value}</span>
        </div>
    );
    const dash = <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />;
    const solid = <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />;

    return (
        <div style={s}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 'bold' }}>☕ MILK &amp; HONEY CAFE</div>
                <div style={{ fontSize: 11 }}>Crafted with love, served with warmth.</div>
            </div>

            {dash}

            {/* Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>{date}</span><span>{time}</span>
            </div>
            <div style={{ fontSize: 11 }}>Order #: <strong>{order.order_number}</strong></div>
            <div style={{ fontSize: 11 }}>
                {order.table?.name ?? 'Walk-in'} &nbsp;|&nbsp;
                <span style={{ textTransform: 'capitalize' }}>{(order.type ?? '').replace('-', ' ')}</span>
            </div>

            {dash}

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 26px 68px', fontSize: 11, fontWeight: 'bold' }}>
                <span>ITEM</span><span>QTY</span><span style={{ textAlign: 'right' }}>AMOUNT</span>
            </div>
            {dash}

            {/* Items */}
            {(order.items ?? []).map((item, i) => (
                <div key={i}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 26px 68px', fontSize: 11 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 128 }}>
                            {item.menu_item.name}
                        </span>
                        <span>{item.quantity}</span>
                        <span style={{ textAlign: 'right' }}>{currency}{Number(item.subtotal).toFixed(2)}</span>
                    </div>
                    {item.addons?.map((a, ai) => (
                        <div key={ai} style={{ paddingLeft: 10, fontSize: 10, color: '#555' }}>+ {a.name}</div>
                    ))}
                </div>
            ))}

            {dash}

            {/* Totals */}
            <div style={{ fontSize: 11 }}>
                {row('Subtotal', `${currency}${Number(order.subtotal).toFixed(2)}`)}
                {Number(order.discount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c00' }}>
                        <span>Discount</span><span>-{currency}{Number(order.discount).toFixed(2)}</span>
                    </div>
                )}
                {row('Tax (VAT Incl.)', `${currency}${Number(order.tax).toFixed(2)}`)}
            </div>

            {solid}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14 }}>
                <span>TOTAL</span><span>{currency}{Number(order.total).toFixed(2)}</span>
            </div>
            {solid}

            {/* Payment */}
            <div style={{ fontSize: 11 }}>
                {row('Payment', payMethod)}
                {cashReceived !== undefined && row('Cash Received', `${currency}${Number(cashReceived).toFixed(2)}`)}
                {change !== undefined && change >= 0 && row('Change', `${currency}${Number(change).toFixed(2)}`, true)}
                {order.payment?.reference_no && row('Reference', order.payment.reference_no)}
            </div>

            {dash}

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
                <div>Thank you for dining with us!</div>
                <div style={{ marginTop: 2 }}>— See you again soon ☕ —</div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#555' }}>This serves as your official receipt.</div>
            </div>

            {dash}
        </div>
    );
}
