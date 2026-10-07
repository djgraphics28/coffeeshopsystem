import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Addon, AddonGroup, MenuItem } from './types';
import { formatMoney, round2 } from './utils';

export interface ItemSelection {
    item: MenuItem; quantity: number; variationId: number | null; addons: Addon[]; notes: string; unitPrice: number;
}

/** Values to start from when an order line is being edited instead of added. */
export interface ItemInitial { lineId: string; quantity: number; variationId: number | null; addons: Addon[]; notes: string }

interface Props {
    item: MenuItem | null;
    initial?: ItemInitial | null;
    /** Every add-on group in the system; the ones the item does not list are offered as extras. */
    allAddonGroups?: AddonGroup[];
    currency: string;
    onClose: () => void;
    onAdd: (selection: ItemSelection) => void;
}

const optionClass = (selected: boolean) =>
    cn(
        'flex min-h-12 min-w-[72px] flex-col items-center justify-center rounded-xl border-2 px-3 py-1.5 text-xs text-foreground transition-all active:scale-95',
        selected ? 'border-primary bg-primary/10' : 'border-[var(--ap-border)] bg-[var(--ap-bg)] hover:border-primary/40',
    );

export function ItemDialog({ item, initial = null, allAddonGroups = [], currency, onClose, onAdd }: Props) {
    return item ? <ItemForm key={`${item.id}:${initial?.lineId ?? 'new'}`} item={item} initial={initial} allAddonGroups={allAddonGroups} currency={currency} onClose={onClose} onAdd={onAdd} /> : null;
}

function ItemForm({ item, initial = null, allAddonGroups = [], currency, onClose, onAdd }: Props & { item: MenuItem }) {
    const [qty, setQty] = useState(initial?.quantity ?? 1);
    const [variationId, setVariationId] = useState<number | null>(initial ? initial.variationId : (item.variations?.[0]?.id ?? null));
    const [selected, setSelected] = useState<Record<number, number[]>>(() => {
        const start: Record<number, number[]> = {};

        for (const group of [...item.addon_groups, ...allAddonGroups]) {
            const ids = group.addons.filter((a) => initial?.addons.some((chosen) => chosen.id === a.id)).map((a) => a.id);

            if (ids.length > 0 && !start[group.id]) {
                start[group.id] = ids;
            }
        }

        return start;
    });
    const [notes, setNotes] = useState(initial?.notes ?? '');
    const [showExtras, setShowExtras] = useState(() => !!initial && allAddonGroups.some((g) => !item.addon_groups.some((own) => own.id === g.id) && g.addons.some((a) => initial.addons.some((c) => c.id === a.id))));

    const ownGroupIds = new Set(item.addon_groups.map((g) => g.id));
    // Extras are only offered on items that have add-ons of their own.
    const hasOwnAddons = item.addon_groups.some((g) => g.addons.length > 0);
    const extraGroups = hasOwnAddons ? allAddonGroups.filter((g) => !ownGroupIds.has(g.id)) : [];
    const extraChosenCount = extraGroups.reduce((n, g) => n + (selected[g.id]?.length ?? 0), 0);

    const basePrice = variationId
        ? (item.variations?.find((v) => v.id === variationId)?.price ?? item.price)
        : (item.display_price ?? item.price);
    const chosenAddons = [...item.addon_groups, ...extraGroups].flatMap((g) => g.addons).filter((a) => Object.values(selected).flat().includes(a.id));
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

    function renderGroup(group: AddonGroup) {
        return (
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
        );
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
                        {canAdd ? `${initial ? 'Update item' : 'Add to Order'} — ${formatMoney(currency, unitPrice * qty)}` : 'Complete required options'}
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

            {item.addon_groups.map((group) => renderGroup(group))}

            {extraGroups.length > 0 && (
                <div className="mb-5">
                    <button type="button" onClick={() => setShowExtras((v) => !v)} aria-expanded={showExtras} className="flex w-full items-center justify-between rounded-xl border border-dashed border-[var(--ap-border)] px-3 py-2.5 text-sm font-semibold text-foreground">
                        <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Other add-ons{extraChosenCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">{extraChosenCount}</span>}</span>
                        <span className="text-xs font-normal text-muted-foreground">{showExtras ? 'Hide' : 'Customer asked for something else?'}</span>
                    </button>
                    {showExtras && <div className="mt-4">{extraGroups.map((group) => renderGroup(group))}</div>}
                </div>
            )}

            <FormField label="Special instructions (optional)">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. less ice, extra hot..." maxLength={200} className={adminFieldClass()} />
            </FormField>
        </CrudModal>
    );
}
