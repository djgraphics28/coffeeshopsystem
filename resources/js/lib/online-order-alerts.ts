import { useSyncExternalStore } from 'react';
import { adminOnlineOrdersPulse } from '@/lib/routes';

/**
 * Admin-wide feed of online orders waiting to be accepted.
 *
 * Lives at module level so it survives Inertia page changes (every admin page mounts its
 * own AdminLayout). Polls the pulse endpoint, and refreshes instantly when Pusher
 * broadcasts a new online order. Raises a chime + desktop notification for each new
 * order, and repeats a reminder every minute while any order is past the 5-minute mark.
 */

export type WaitingOrder = {
    id: number;
    order_number: string;
    type: string;
    total: number;
    customer: string | null;
    created_at: string;
    waiting_minutes: number;
};

type AlertState = {
    waiting: WaitingOrder[];
    reminderMinutes: number;
    /** Orders past the reminder window. */
    overdue: WaitingOrder[];
    /** Browser notification permission (or 'unsupported'). */
    permission: NotificationPermission | 'unsupported';
    /** Sound plays only after the admin interacted once (browser autoplay rules). */
    soundReady: boolean;
};

const POLL_MS = 15_000;
const REMIND_EVERY_MS = 60_000;

let state: AlertState = { waiting: [], reminderMinutes: 5, overdue: [], permission: 'default', soundReady: false };
const listeners = new Set<() => void>();
const seen = new Set<number>();
const remindedOnce = new Set<number>();
let started = false;
let firstLoad = true;
let lastReminderAt = 0;
let audio: AudioContext | null = null;
let onNewOrder: ((order: WaitingOrder) => void) | null = null;

function emit(next: Partial<AlertState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
}

function minutesWaiting(order: WaitingOrder): number {
    return Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000);
}

/** A short two-note chime (no audio file needed). `urgent` plays it twice. */
export function playChime(urgent = false): void {
    if (!audio || audio.state !== 'running') {
        return;
    }

    const notes = urgent ? [880, 660, 880, 660] : [660, 880];

    notes.forEach((frequency, index) => {
        const oscillator = audio!.createOscillator();
        const gain = audio!.createGain();
        const start = audio!.currentTime + index * 0.22;

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        oscillator.connect(gain).connect(audio!.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.22);
    });
}

function notifyDesktop(title: string, body: string, tag: string) {
    if (state.permission !== 'granted') {
        return;
    }

    try {
        const notification = new Notification(title, { body, tag, icon: '/favicon.ico', requireInteraction: true });
        notification.onclick = () => {
            window.focus();
            window.location.href = '/admin/online-orders';
        };
    } catch {
        // Some browsers only allow notifications from a service worker.
    }
}

function money(value: number): string {
    return `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

async function refresh(): Promise<void> {
    let data: { waiting: WaitingOrder[]; reminder_minutes: number };

    try {
        const response = await fetch(adminOnlineOrdersPulse(), { headers: { Accept: 'application/json' }, credentials: 'same-origin' });

        if (!response.ok) {
            return;
        }

        data = await response.json();
    } catch {
        return;
    }

    const fresh = data.waiting.filter((order) => !seen.has(order.id));
    data.waiting.forEach((order) => seen.add(order.id));

    if (!firstLoad && fresh.length > 0) {
        playChime();
        fresh.forEach((order) => {
            onNewOrder?.(order);
            notifyDesktop(`New online order #${order.order_number}`, `${order.customer ?? 'A customer'} · ${order.type} · ${money(order.total)} — tap to accept`, `order-${order.id}`);
        });
    }

    firstLoad = false;
    emit({ waiting: data.waiting, reminderMinutes: data.reminder_minutes });
    checkReminders();
}

/** Every minute while something is overdue: chime again, and a desktop notification once per order. */
function checkReminders() {
    const overdue = state.waiting.filter((order) => minutesWaiting(order) >= state.reminderMinutes);
    emit({ overdue });

    if (overdue.length === 0) {
        return;
    }

    overdue
        .filter((order) => !remindedOnce.has(order.id))
        .forEach((order) => {
            remindedOnce.add(order.id);
            notifyDesktop(
                `⏰ Order #${order.order_number} is still waiting`,
                `Nobody has accepted it for ${minutesWaiting(order)} minutes. The customer is waiting for confirmation.`,
                `remind-${order.id}`,
            );
        });

    if (Date.now() - lastReminderAt >= REMIND_EVERY_MS) {
        lastReminderAt = Date.now();
        playChime(true);
    }
}

/** Unlock sound and ask for desktop notifications (must run from a click). */
export async function enableAlerts(): Promise<void> {
    if (!audio && typeof AudioContext !== 'undefined') {
        audio = new AudioContext();
    }

    await audio?.resume().catch(() => undefined);
    emit({ soundReady: audio?.state === 'running' });

    if ('Notification' in window && Notification.permission === 'default') {
        emit({ permission: await Notification.requestPermission() });
    }

    playChime();
}

export function startOnlineOrderAlerts(handleNewOrder: (order: WaitingOrder) => void): void {
    onNewOrder = handleNewOrder;

    if (started || typeof window === 'undefined') {
        return;
    }

    started = true;
    emit({ permission: 'Notification' in window ? Notification.permission : 'unsupported' });

    // The first click anywhere unlocks sound (browsers block audio until the user interacts).
    const unlock = () => {
        audio ??= typeof AudioContext !== 'undefined' ? new AudioContext() : null;
        audio
            ?.resume()
            .then(() => emit({ soundReady: audio?.state === 'running' }))
            .catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock, { once: true });

    void refresh();
    window.setInterval(() => void refresh(), POLL_MS);
    window.setInterval(checkReminders, 20_000);

    // Instant updates when realtime (Pusher) is configured; polling covers it otherwise.
    import('@/echo')
        .then(({ default: echo }) => {
            echo?.channel('online-orders').listen('.online-order.placed', () => void refresh());
        })
        .catch(() => undefined);
}

/** Re-fetch right away (e.g. after accepting / declining). */
export function refreshOnlineOrderAlerts(): void {
    void refresh();
}

export function useOnlineOrderAlerts(): AlertState {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => state,
        () => state,
    );
}
