const CLEANUP_KEY = 'grabio_invoice_pwa_cleanup_v1';

/** Tear down legacy invoice PWA caches that serve stale JS chunks after deploy. */
export function runInvoicePwaCleanupOnce(): void {
  if (typeof window === 'undefined') return;

  try {
    if (localStorage.getItem(CLEANUP_KEY) === '1') return;
    localStorage.setItem(CLEANUP_KEY, '1');
  } catch {
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }

  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => caches.delete(cacheName));
    });
  }
}
