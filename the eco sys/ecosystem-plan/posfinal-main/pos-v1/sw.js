// ===================================
// AYN BEIRUT POS - SERVICE WORKER
// Offline-first capability with versioned caching
// ===================================

const CACHE_VERSION = 'v2.0.1';
const CACHE_NAME = `ayn-pos-${CACHE_VERSION}`;

// CORE assets - Cache-first strategy (instant offline load)
const CORE_ASSETS = [
    './',
    './index.html',
    './login.html',
    './css/styles.css',
    './css/ui-ux-standards.css',
    './icon.png',
    './lib/sql-wasm.js',
    './lib/sql-wasm.wasm',
    './js/migrations-bundle.js',
    './js/storage-manager.js',
    './js/db-sql.js',
    './js/migrate-to-sql.js',
    './js/disaster-recovery.js',
    './js/sync-manager.js',
    './js/loading-utils.js',
    './js/dropdown-manager.js',
    './js/anti-blocking.js',
    './js/settings.js',
    './js/page-navigation.js',
    './js/auth.js',
    './js/phonebook.js',
    './js/virtual-keyboard.js',
    './js/receipt.js',
    './js/product-management.js',
    './js/payment.js',
    './js/customers.js',
    './js/categories.js',
    './js/pos-core.js',
    './js/theme-switcher.js',
    './js/ripple-effect.js',
    './js/error-boundary.js',
    './js/logger.js',
    './js/app.js'
];

// External resources - Stale-while-revalidate
const EXTERNAL_FONTS = [
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap'
];

// ===================================
// INSTALL EVENT
// ===================================

self.addEventListener('install', (event) => {
    console.log(`[ServiceWorker] Installing ${CACHE_VERSION}...`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Pre-caching core assets');
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => {
                console.log(`[ServiceWorker] ${CACHE_VERSION} installed successfully`);
                // Force immediate activation
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[ServiceWorker] Installation failed:', error);
            })
    );
});

// ===================================
// ACTIVATE EVENT - Clean old caches
// ===================================

self.addEventListener('activate', (event) => {
    console.log(`[ServiceWorker] Activating ${CACHE_VERSION}...`);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete any cache that doesn't match current version
                        if (cacheName.startsWith('ayn-pos-') && cacheName !== CACHE_NAME) {
                            console.log('[ServiceWorker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log(`[ServiceWorker] ${CACHE_VERSION} activated`);
                // Take control of all clients immediately
                return self.clients.claim();
            })
    );
});

// ===================================
// FETCH EVENT - Smart caching strategy
// ===================================

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Network-first for database file (always get latest sync)
    if (url.pathname.includes('pos-database.sqlite') || url.pathname.includes('AynBeirutPOS')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // Cache-first for core assets (instant offline)
    if (CORE_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    return fetch(event.request)
                        .then((response) => {
                            if (!response || response.status !== 200) {
                                return response;
                            }
                            
                            // Cache for future offline use
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                            
                            return response;
                        });
                })
        );
        return;
    }
    
    // Stale-while-revalidate for external resources (fonts, etc)
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    const fetchPromise = fetch(event.request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            }
                            return response;
                        })
                        .catch(() => cachedResponse); // Fallback to cache on network error
                    
                    return cachedResponse || fetchPromise;
                })
        );
        return;
    }
    
    // Default: Network-first with cache fallback
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Don't cache if not a successful response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                
                // Clone the response
                const responseToCache = response.clone();
                
                // Cache the fetched response for future use
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                
                return response;
            })
            .catch(() => {
                // Network failed, try to return a fallback
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
            })
    );
});

// ===================================
// MESSAGE EVENT
// ===================================

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(event.data.urls);
            });
    }
});
