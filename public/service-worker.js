// This is a basic service worker for PWA offline support and caching.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip Firebase Storage requests to avoid CORS issues
  if (event.request.url.includes('firebasestorage.googleapis.com')) {
    return;
  }
  event.respondWith(
    caches.open('market-flow-cache-v1').then((cache) => {
      return cache.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request).then((networkResponse) => {
            if (
              event.request.method === 'GET' &&
              event.request.url.startsWith('http')
            ) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
        );
      });
    })
  );
});
