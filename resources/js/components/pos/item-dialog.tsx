import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Addon, MenuItem } from './types';
import { formatMoney, round2 } from './utils';

export interface ItemSelection {
    item: MenuItem; quantity: number; variationId: number | null; addons: Addon[]; notes: string; unitPrice: number;
}

interface Props {
    item: MenuItem | null;
    currency: string;
    onClose: () => void;
    onAdd: (selection: ItemSelection) => void;
}

const optionClass = (selected: boolean) =>
    cn(
        'flex min-h-12 min-w-[72px] flex-col items-center justify-center rounded-xl border-2 px-3 py-1.5 text-xs text-foreground transition-all active:scale-95',
        selected ? 'border-primary bg-primary/10' : 'border-[var(--ap-border)] bg-[var(--ap-bg)] hover:border-primary/40',
    );

export function ItemDialog({ item, currency, onClose, onAdd }: Props) {
    return item ? <ItemForm key={item.id} item={item} currency={currency} onClose={onClose} onAdd={onAdd} /> : null;
}

function ItemForm({ item, currency, onClose, onAdd }: Props & { item: MenuItem }) {
    const [qty, setQty] = useState(1);
    const [variationId, setVariationId] = useState<number | null>(item.variations?.[0]?.id ?? null);
    const [selected, setSelected] = useState<Record<number, number[]>>({});
    const [notes, setNotes] = useState('');

    const basePrice = variationId
        ? (item.variations?.find((v) => v.id === variationId)?.price ?? item.price)
        : (item.display_price ?? item.price);
    const chosenAddons = item.addon_groups.flatMap((g) => g.addons).filter((a) => Object.values(selected).flat().includes(a.id));
    const unitPrice = round2(Number(basePrice) + chosenAddons.reduce((s, a) => s + Number(a.additional_price), 0));
    const missingRequired = item.addon_groups.filter((g) => g.is_required && !(selected[g.id]?.length > 0));
    const canAdd = !(item.has_variations && !variationId) && missingRequired.length === 0;

    function toggle(groupId: number, addonId: number, max: number) {
        setSelected((prev) => {
            const current = prev[groupId] ?? [];

            if (current.includes(addonId)) {
 return { ...prev, [groupId]: current.filter((id) => id !== addonId) }; 
}

            if (max === 1) {
 return { ...prev, [groupId]: [addonId] }; 
}

            return current.length < max ? { ...prev, [groupId]: [...current, addonId] } : prev;
        });
    }

    return (
        <CrudModal
            open
            onOpenChange={(open) => !open && onClose()}
            title={item.name}
            description={item.description || undefined}
            footer={
                <div className="flex w-full items-center gap-3">
                    <div className="flex items-center rounded-full border border-[var(--ap-border)]">
                        <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-11 w-11 items-center justify-center"><Minus className="h-4 w-4" /></button>
                        <span className="w-7 text-center font-bold text-foreground">{qty}</span>
                        <button aria-label="Increase quantity" onClick={() => setQty(qty + 1)} className="flex h-11 w-11 items-center justify-center"><Plus className="h-4 w-4" /></button>
                    </div>
                    <Button className="h-11 flex-1" disabled={!canAdd} onClick={() => onAdd({ item, quantity: qty, variationId, addons: chosenAddons, notes, unitPrice })}>
                        {canAdd ? `Add to Order — ${formatMoney(currency, unitPrice * qty)}` : 'Complete required options'}
                    </Button>
                </div>
            }
        >
            {item.variations && item.variations.length > 0 && (
                <div className="mb-5">
                    <p className="mb-2 text-sm font-semibold text-foreground">Size <span className="text-error">*</span></p>
                    <div className="flex flex-wrap gap-2">
                        {item.variations.map((v) => (
                            <button key={v.id} onClick={() => setVariationId(v.id)} className={optionClass(variationId === v.id)}>
                                <span className="font-medium">{v.name}</span>
                                <span className="text-[10px] text-primary">{formatMoney(currency, v.price)}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {item.addon_groups.map((group) => (
                <div key={group.id} className="mb-5">
                    <p className="mb-2 text-sm font-semibold text-foreground">
                        {group.name} {group.is_required && <span className="text-error">*</span>}
                        {group.max_selections > 1 && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">({selected[group.id]?.length ?? 0}/{group.max_selections})</span>
                        )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {group.addons.map((addon) => {
                            const price = Number(addon.additional_price);
                            const label = price > 0 ? `+${formatMoney(currency, price)}` : price < 0 ? `-${formatMoney(currency, Math.abs(price))}` : 'Free';

                            return (
                                <button key={addon.id} onClick={() => toggle(group.id, addon.id, group.max_selections)} className={optionClass(!!selected[group.id]?.includes(addon.id))}>
                                    <span className="font-medium">{addon.name}</span>
                                    <span className={cn('text-[10px]', price !== 0 ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            <FormField label="Special instructions (optional)">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. less ice, extra hot..." maxLength={200} className={adminFieldClass()} />
            </FormField>
        </CrudModal>
    );
}
