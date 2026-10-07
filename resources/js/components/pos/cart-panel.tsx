import { Minus, Plus, Settings2, Star, Tag, Trash2, UserCircle, X } from 'lucide-react';
import { adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CartItem, Customer, OrderType, TableOption } from './types';
import { formatMoney } from './utils';

interface Props {
    cart: CartItem[];
    currency: string;
    taxRate: number;
    totals: { subtotal: number; discount: number; tax: number; total: number };
    orderType: OrderType;
    onOrderType: (type: OrderType) => void;
    tables: TableOption[];
    tableId: number | null;
    onTable: (id: number) => void;
    customer: Customer | null;
    onPickCustomer: () => void;
    onClearCustomer: () => void;
    notes: string;
    onNotes: (value: string) => void;
    discountValue: number;
    discountMode: 'amount' | 'percent';
    onDiscount: (value: number, mode: 'amount' | 'percent') => void;
    onQuantity: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    onEdit: (id: string) => void;
    onClear: () => void;
    onSubmit: () => void;
    submitting: boolean;
    payAsYouOrder: boolean;
    onClose?: () => void;
}

const TYPES: Array<{ id: OrderType; label: string }> = [
    { id: 'walkin', label: 'Walk-in' },
    { id: 'dine-in', label: 'Dine in' },
    { id: 'takeout', label: 'Takeout' },
];

export function CartPanel(p: Props) {
    const needsTable = p.orderType === 'dine-in' && !p.tableId;
    const blocked = p.cart.length === 0 || needsTable || p.submitting;
    const count = p.cart.reduce((n, i) => n + i.quantity, 0);

    return (
        <div className="flex h-full flex-col bg-card">
            <div className="flex shrink-0 items-center justify-between bg-primary px-4 py-3">
                <p className="font-bold text-primary-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                    New Order {count > 0 && <span className="ml-1 text-sm font-normal opacity-80">· {count} item{count > 1 ? 's' : ''}</span>}
                </p>
                <div className="flex items-center gap-1">
                    {p.cart.length > 0 && (
                        <button onClick={p.onClear} className="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-primary-foreground/80 hover:bg-white/10"><Trash2 className="h-3.5 w-3.5" />Clear</button>
                    )}
                    {p.onClose && (
                        <button onClick={p.onClose} aria-label="Close order panel" className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground hover:bg-white/10 lg:hidden"><X className="h-4 w-4" /></button>
                    )}
                </div>
            </div>

            <div className="shrink-0 space-y-3 border-b border-[var(--ap-border)] p-4">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--ap-bg)] p-1" role="tablist">
                    {TYPES.map((t) => (
                        <button key={t.id} role="tab" aria-selected={p.orderType === t.id} onClick={() => p.onOrderType(t.id)}
                            className={cn('h-10 rounded-lg text-sm font-medium transition-all', p.orderType === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {p.orderType === 'dine-in' && (
                    <div>
                        <p className={cn('mb-1.5 text-xs font-medium', needsTable ? 'text-error' : 'text-muted-foreground')}>{needsTable ? 'Select a table to continue' : 'Table'}</p>
                        {p.tables.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No tables configured.</p>
                        ) : (
                            <div className="grid max-h-28 grid-cols-4 gap-1.5 overflow-y-auto">
                                {p.tables.map((t) => (
                                    <button key={t.id} onClick={() => p.onTable(t.id)}
                                        className={cn('h-10 truncate rounded-lg border px-1 text-xs font-medium transition-all', p.tableId === t.id ? 'border-transparent bg-primary text-primary-foreground' : 'border-[var(--ap-border)] bg-[var(--ap-bg)] text-foreground')}>
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <div className={cn('flex items-center rounded-xl border transition-all', p.customer ? 'border-primary bg-primary/10' : 'border-[var(--ap-border)] bg-[var(--ap-bg)]')}>
                        <button onClick={p.onPickCustomer} className="flex h-10 min-w-0 flex-1 items-center gap-2 px-3 text-sm">
                            <UserCircle className={cn('h-4 w-4 shrink-0', p.customer ? 'text-primary' : 'text-muted-foreground')} />
                            <span className={cn('truncate', p.customer ? 'font-medium text-foreground' : 'text-muted-foreground')}>{p.customer ? p.customer.name : 'Add customer (optional)'}</span>
                        </button>
                        {p.customer && (
                            <button onClick={p.onClearCustomer} aria-label="Remove customer" className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10"><X className="h-3.5 w-3.5" /></button>
                        )}
                    </div>
                    {p.customer && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 px-1 text-xs">
                            {p.customer.points > 0 && <span className="flex items-center gap-0.5 font-medium text-warning"><Star className="h-3 w-3" />{p.customer.points.toLocaleString()} pts</span>}
                            {p.customer.cup_count > 0 && <span className="text-foreground">☕ {p.customer.cup_count} cups</span>}
                            {p.customer.free_drinks_available > 0 && <span className="font-semibold text-success">🎁 {p.customer.free_drinks_available} free</span>}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
                {p.cart.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground">
                        <span className="mb-3 text-5xl opacity-60">🛒</span>
                        <p className="text-sm font-medium text-foreground">Order is empty</p>
                        <p className="text-xs">Tap a menu item to add it</p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {p.cart.map((item) => (
                            <li key={item.id} className="rounded-xl border border-[var(--ap-border)] bg-[var(--ap-bg)] p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-foreground">{item.menuItem.name}</p>
                                        {(item.selectedVariation || item.selectedAddons.length > 0) && (
                                            <p className="text-xs text-muted-foreground">{[item.selectedVariation?.name, ...item.selectedAddons.map((a) => a.name)].filter(Boolean).join(', ')}</p>
                                        )}
                                        {item.notes && <p className="mt-0.5 text-xs text-muted-foreground italic">"{item.notes}"</p>}
                                    </div>
                                    <button onClick={() => p.onRemove(item.id)} aria-label={`Remove ${item.menuItem.name}`} className="-mt-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-error/10 hover:text-error"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <div className="flex items-center rounded-full border border-[var(--ap-border)] bg-card">
                                        <button onClick={() => p.onQuantity(item.id, -1)} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center"><Minus className="h-3.5 w-3.5" /></button>
                                        <span className="w-6 text-center text-sm font-bold text-foreground">{item.quantity}</span>
                                        <button onClick={() => p.onQuantity(item.id, 1)} aria-label="Increase quantity" className="flex h-9 w-9 items-center justify-center"><Plus className="h-3.5 w-3.5" /></button>
                                    </div>
                                    {item.menuItem.addon_groups.some((g) => g.addons.length > 0) ? <button onClick={() => p.onEdit(item.id)} aria-label={`Edit add-ons for ${item.menuItem.name}`} className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--ap-border)] bg-card px-3 text-xs font-medium text-foreground hover:border-primary/40"><Settings2 className="h-3.5 w-3.5 text-primary" /> Add-ons</button> : <span />}
                                    <span className="text-sm font-bold text-primary">{formatMoney(p.currency, item.unitPrice * item.quantity)}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="shrink-0 border-t border-[var(--ap-border)] p-4">
                <textarea value={p.notes} onChange={(e) => p.onNotes(e.target.value)} placeholder="Order notes..." rows={1} maxLength={500} className={adminFieldClass() + ' mb-3 resize-none'} />
                <div className="mb-3 flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Discount</span>
                    <div className="ml-auto flex items-center gap-1.5">
                        <div className="flex rounded-lg bg-[var(--ap-bg)] p-0.5 text-xs font-semibold">
                            {(['amount', 'percent'] as const).map((m) => (
                                <button key={m} onClick={() => p.onDiscount(p.discountValue, m)} className={cn('h-8 w-9 rounded-md', p.discountMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{m === 'amount' ? p.currency : '%'}</button>
                            ))}
                        </div>
                        <input type="number" inputMode="decimal" min={0} max={p.discountMode === 'percent' ? 100 : undefined} value={p.discountValue || ''} onChange={(e) => p.onDiscount(Math.max(0, parseFloat(e.target.value) || 0), p.discountMode)} placeholder="0" aria-label="Discount" className={adminFieldClass() + ' h-9 w-20 py-1 text-right'} />
                    </div>
                </div>
                <dl className="mb-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(p.currency, p.totals.subtotal)}</dd></div>
                    {p.totals.discount > 0 && <div className="flex justify-between text-error"><dt>Discount</dt><dd>-{formatMoney(p.currency, p.totals.discount)}</dd></div>}
                    <div className="flex justify-between"><dt>Tax ({p.taxRate}%)</dt><dd>{formatMoney(p.currency, p.totals.tax)}</dd></div>
                </dl>
                <div className="mb-3 flex items-center justify-between">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-primary">{formatMoney(p.currency, p.totals.total)}</span>
                </div>
                <Button className="h-12 w-full text-base" onClick={p.onSubmit} disabled={blocked}>
                    {p.submitting ? 'Placing...' : needsTable ? 'Select a table' : p.payAsYouOrder ? 'Place Order & Pay' : 'Place Order'}
                </Button>
            </div>
        </div>
    );
}
