import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react';
import { useState } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Order, PayMethod } from './types';
import { formatMoney, round2 } from './utils';

export interface PaymentSubmission { amount: number; method: PayMethod; referenceNo: string | null }

interface Props {
    order: Order | null;
    currency: string;
    submitting: boolean;
    onClose: () => void;
    onSubmit: (payment: PaymentSubmission) => void;
}

const METHODS: Array<{ id: PayMethod; label: string; icon: typeof Banknote }> = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'gcash', label: 'GCash', icon: Smartphone },
    { id: 'maya', label: 'Maya', icon: Wallet },
];

/** Fixed cash denominations offered as quick buttons. */
const CASH_PRESETS = [50, 100, 200, 500, 1000];

export function PaymentDialog(props: Props) {
    return props.order ? <PaymentForm key={props.order.id} {...props} order={props.order} /> : null;
}

function PaymentForm({ order, currency, submitting, onClose, onSubmit }: Props & { order: Order }) {
    const [method, setMethod] = useState<PayMethod>('cash');
    const [cash, setCash] = useState('');
    const [reference, setReference] = useState('');


    const total = round2(Number(order.total));
    const isCash = method === 'cash';
    const received = cash === '' ? total : parseFloat(cash) || 0;
    const short = isCash && received < total;
    const change = isCash ? round2(Math.max(0, received - total)) : 0;

    function submit() {
        if (short || submitting) {
 return; 
}

        onSubmit({ amount: isCash ? received : total, method, referenceNo: reference.trim() || null });
    }

    return (
        <CrudModal
            open
            onOpenChange={(open) => !open && !submitting && onClose()}
            title={<span className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Take Payment</span>}
            className="max-w-sm"
            footer={
                <Button className="h-12 w-full text-base" onClick={submit} disabled={short || submitting}>
                    {submitting ? 'Processing...' : `Confirm ${formatMoney(currency, isCash ? received : total)}`}
                </Button>
            }
        >
            <div className="mb-4 flex items-end justify-between rounded-xl bg-primary p-4 text-primary-foreground">
                <div>
                    <p className="text-xs text-primary-foreground/70">Amount due</p>
                    <p className="text-3xl leading-tight font-bold">{formatMoney(currency, total)}</p>
                </div>
                <p className="text-sm font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>{order.order_number}</p>
            </div>

            <div className="mb-4 grid grid-cols-4 gap-2">
                {METHODS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setMethod(id)}
                        className={cn(
                            'flex h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 text-xs font-medium transition-all active:scale-95',
                            method === id ? 'border-primary bg-primary/10 text-foreground' : 'border-[var(--ap-border)] bg-[var(--ap-bg)] text-muted-foreground',
                        )}
                    >
                        <Icon className="h-5 w-5" />{label}
                    </button>
                ))}
            </div>

            {isCash ? (
                <form onSubmit={(e) => {
 e.preventDefault(); submit(); 
}}>
                    <label htmlFor="pos-cash" className="mb-1 block text-xs text-muted-foreground">Cash received</label>
                    <input
                        id="pos-cash" autoFocus type="number" inputMode="decimal" min={0} step="0.01"
                        value={cash} onChange={(e) => setCash(e.target.value)} placeholder={total.toFixed(2)}
                        className={adminFieldClass(short) + ' py-3 text-xl font-bold'}
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setCash('')} className={chipClass(cash === '')}>Exact</button>
                        {CASH_PRESETS.map((amt) => (
                            <button
                                type="button"
                                key={amt}
                                disabled={amt < total}
                                title={amt < total ? 'Not enough to cover the total' : undefined}
                                onClick={() => setCash(String(amt))}
                                className={cn(chipClass(cash === String(amt)), 'disabled:cursor-not-allowed disabled:opacity-40')}
                            >
                                {formatMoney(currency, amt).replace(/\.00$/, '')}
                            </button>
                        ))}
                    </div>
                    <div className={cn('mt-3 flex items-center justify-between rounded-xl px-4 py-3', short ? 'bg-error/10 text-error' : 'bg-success/10 text-success')}>
                        <span className="text-sm font-medium">{short ? 'Short by' : 'Change'}</span>
                        <span className="text-lg font-bold">{formatMoney(currency, short ? total - received : change)}</span>
                    </div>
                </form>
            ) : (
                <form onSubmit={(e) => {
 e.preventDefault(); submit(); 
}}>
                    <label htmlFor="pos-ref" className="mb-1 block text-xs text-muted-foreground">Reference number (optional)</label>
                    <input id="pos-ref" autoFocus value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Enter reference no." maxLength={100} className={adminFieldClass()} />
                </form>
            )}
        </CrudModal>
    );
}

const chipClass = (active: boolean) =>
    cn(
        'rounded-full border px-4 py-2 text-xs font-medium transition-all',
        active ? 'border-transparent bg-primary text-primary-foreground' : 'border-[var(--ap-border)] bg-[var(--ap-bg)] text-muted-foreground',
    );
