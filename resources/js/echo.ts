import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo?: Echo<'pusher'>;
    }
}

// Realtime is optional: without a Pusher key (e.g. BROADCAST_CONNECTION=log) Echo
// throws on construction, which would blank every page importing this module.
const key = import.meta.env.VITE_PUSHER_APP_KEY;

if (typeof window !== 'undefined' && key) {
    window.Pusher = Pusher;

    window.Echo = new Echo({
        broadcaster: 'pusher',
        key,
        cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
        forceTLS: true,
    });
}

export default typeof window !== 'undefined' ? (window.Echo ?? null) : null;
