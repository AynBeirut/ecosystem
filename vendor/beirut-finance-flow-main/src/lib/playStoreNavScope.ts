/**
 * Play Store v1 — focused invoicing nav in TWA/PWA shell only.
 * Desktop browser at grabio.space/invoice keeps full navigation.
 *
 * VITE_PLAY_STORE_V1_NAV:
 *   auto (default) — trim when display-mode is standalone (Play Store TWA / installed PWA)
 *   force — always trim (local testing)
 *   off — never trim
 */

const WEB_APP_ORIGIN = 'https://grabio.space';
const PLAY_STORE_SESSION_KEY = 'grabio-finance-play-app';
const PLAY_STORE_PACKAGE = 'space.grabio.finance';

/** Call once on app boot — marks Play Store / TWA sessions even when Chrome uses Custom Tabs. */
export function bootstrapPlayStoreShell(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const fromLaunchParam =
    params.get('source') === 'grabio-finance-app' || params.get('app') === 'play';
  const fromReferrer = document.referrer.startsWith(`android-app://${PLAY_STORE_PACKAGE}`);

  if (fromLaunchParam || fromReferrer) {
    try {
      sessionStorage.setItem(PLAY_STORE_SESSION_KEY, '1');
      localStorage.setItem(PLAY_STORE_SESSION_KEY, '1');
    } catch {
      /* private mode */
    }
  }

  if (fromLaunchParam && window.history.replaceState) {
    params.delete('source');
    params.delete('app');
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  }
}

/** Core billing routes for Play Store v1 (matches B4b scope). */
export const PLAY_STORE_V1_NAV_PATHS = [
  '/invoices',
  '/estimates',
  '/receipts',
  '/clients',
  '/products',
  '/reports',
  '/settings',
] as const;

/** Routes reachable in the Android app (auth callbacks + profile redirect). */
export const PLAY_STORE_V1_ALLOWED_PATHS = [
  '/',
  ...PLAY_STORE_V1_NAV_PATHS,
  '/profile',
  '/auth/callback',
  '/install',
  '/payment-success',
] as const;

export type PlayStoreV1NavPath = (typeof PLAY_STORE_V1_NAV_PATHS)[number];

export function getPlayStoreV1NavMode(): 'auto' | 'force' | 'off' {
  const raw = String(import.meta.env.VITE_PLAY_STORE_V1_NAV || 'auto').toLowerCase();
  if (raw === 'force' || raw === 'off') return raw;
  return 'auto';
}

function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isPlayStoreV1Shell(): boolean {
  if (typeof window === 'undefined') return false;
  const mode = getPlayStoreV1NavMode();
  if (mode === 'off') return false;
  if (mode === 'force') return true;

  if (sessionStorage.getItem(PLAY_STORE_SESSION_KEY) === '1') return true;
  try {
    if (localStorage.getItem(PLAY_STORE_SESSION_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  if (document.referrer.startsWith(`android-app://${PLAY_STORE_PACKAGE}`)) return true;

  // TWA on grabio.space/invoice — treat as Play app even when display-mode is browser
  if (isAndroidWebView() && window.location.hostname === 'grabio.space') {
    const p = window.location.pathname;
    if (p === '/invoice' || p.startsWith('/invoice/')) return true;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function normalizeAppPath(pathname: string): string {
  let path = pathname || '/';
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

  if (base && base !== '/' && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length) || '/';
  }
  // Deep links may still carry /invoice prefix (TWA shortcuts, external links)
  if (path.startsWith('/invoice/')) {
    path = path.slice('/invoice'.length) || '/';
  } else if (path === '/invoice') {
    path = '/';
  }

  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

export function isPlayStoreV1AllowedPath(pathname: string): boolean {
  const path = normalizeAppPath(pathname);
  return (PLAY_STORE_V1_ALLOWED_PATHS as readonly string[]).includes(path);
}

export function playStoreWebUrl(path = '/invoice/'): string {
  return `${WEB_APP_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
