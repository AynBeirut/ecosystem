function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

function stripManifestLinks(): void {
  document.querySelectorAll('link[rel="manifest"]').forEach((node) => node.remove());
}

function teardownPwa(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }

  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        if (
          cacheName.includes('workbox') ||
          cacheName.includes('grabio') ||
          cacheName.includes('invoice')
        ) {
          caches.delete(cacheName);
        }
      });
    });
  }
}

/** Local dev: always disable PWA so Chrome does not hijack localhost into standalone mode. */
export function runPwaCleanupOnLocalDev(): void {
  if (!isLocalDevHost()) return;
  stripManifestLinks();
  teardownPwa();
}

const CLEANUP_KEY = 'grabio_pwa_cleanup_v8';

/** One-time legacy PWA teardown on production — avoids re-clearing caches every refresh. */
export function runPwaCleanupOnce(): void {
  if (typeof window === 'undefined') return;

  if (isLocalDevHost()) {
    runPwaCleanupOnLocalDev();
    return;
  }

  try {
    if (localStorage.getItem(CLEANUP_KEY) === '1') return;
    localStorage.setItem(CLEANUP_KEY, '1');
  } catch {
    return;
  }

  teardownPwa();
}
