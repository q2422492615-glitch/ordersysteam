const CACHE_NAME = 'yuanhe-pwa-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/icons/logo.png',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.error("SW cache install error:", err))
    );
});

self.addEventListener('fetch', event => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(fetchResponse => {
                        // Optionally cache new resources here dynamically
                        return fetchResponse;
                    })
                    .catch(() => {
                        // Optional offline fallback
                    });
            })
    );
});
