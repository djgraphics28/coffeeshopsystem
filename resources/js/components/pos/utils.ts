import type { Addon, CartItem, MenuItem } from './types';

export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const formatMoney = (currency: string, value: number): string =>
    `${currency}${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Items that need no choices can be added with a single tap. */
export const needsCustomization = (item: MenuItem): boolean =>
    (item.variations?.length ?? 0) > 0 || item.addon_groups.some((g) => g.addons.length > 0);

export const lineKey = (item: Pick<CartItem, 'menuItem' | 'selectedVariation' | 'selectedAddons' | 'notes'>): string =>
    [
        item.menuItem.id,
        item.selectedVariation?.id ?? 0,
        item.selectedAddons.map((a: Addon) => a.id).sort((a, b) => a - b).join('.'),
        item.notes.trim().toLowerCase(),
    ].join('|');

export function calculateTotals(cart: CartItem[], discountValue: number, discountMode: 'amount' | 'percent', taxRate: number) {
    const subtotal = round2(cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
    const requested = discountMode === 'percent' ? subtotal * (Math.min(discountValue, 100) / 100) : discountValue;
    const discount = round2(Math.min(Math.max(requested, 0), subtotal));
    const tax = round2((subtotal - discount) * (taxRate / 100));

    return { subtotal, discount, tax, total: round2(subtotal - discount + tax) };
}

export class ApiError extends Error {}

/** JSON request helper for the POS endpoints; surfaces Laravel validation messages. */
export async function apiRequest<T>(url: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    const socketId = (window as unknown as { Echo?: { socketId(): string | undefined } }).Echo?.socketId() ?? '';
    const res = await fetch(url, {
        method,
        signal,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrf,
            ...(socketId ? { 'X-Socket-ID': socketId } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => null);
        const first = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null;

        throw new ApiError(first ?? data?.message ?? 'Something went wrong. Please try again.');
    }

    return res.json();
}
