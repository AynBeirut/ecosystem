const CLEANUP_KEY = 'grabio_pwa_cleanup_v4';

/** One-time legacy PWA teardown — avoids re-clearing caches on every refresh (which caused flicker). */
export function runPwaCleanupOnce(): void {
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
