/*
 * Service worker for the installable app.
 *
 * It keeps the built JS/CSS/fonts and icons so the app opens quickly and the shell survives a flaky connection.
 * It deliberately never stores pages, API responses or anything sent with a POST: orders, payments and the
 * signed-in screens always come live from the server. When the network is down, a friendly offline page is shown.
 */
const VERSION = 'v1';
const STATIC_CACHE = `mh-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png']))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mh-static-') && key !== STATIC_CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Page loads: always live; fall back to the offline page when there is no connection.
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));

        return;
    }

    // Fingerprinted build files and icons never change under the same URL, so cache-first is safe.
    if (url.pathname.startsWith('/build/assets/') || url.pathname.startsWith('/icons/')) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
                }

                return response;
            })),
        );
    }
});
