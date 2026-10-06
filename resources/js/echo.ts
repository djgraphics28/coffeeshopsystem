import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo?: Echo<'pusher'>;
        __pusher?: { key: string | null; cluster: string | null };
    }
}

// Credentials come from the system settings (injected by app.blade.php), with the Vite env as a fallback.
// Realtime is optional: without a Pusher key Echo throws on construction,
// which would blank every page importing this module.
const key = (typeof window !== 'undefined' ? window.__pusher?.key : null) || import.meta.env.VITE_PUSHER_APP_KEY;
const cluster = (typeof window !== 'undefined' ? window.__pusher?.cluster : null) || import.meta.env.VITE_PUSHER_APP_CLUSTER || 'ap1';

if (typeof window !== 'undefined' && key) {
    window.Pusher = Pusher;

    window.Echo = new Echo({
        broadcaster: 'pusher',
        key,
        cluster,
        forceTLS: true,
    });
}

export default typeof window !== 'undefined' ? (window.Echo ?? null) : null;
