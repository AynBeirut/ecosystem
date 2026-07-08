import { isPlayStoreV1Shell } from '@/lib/playStoreNavScope';

/** Popup breaks in TWA, Android WebView, and many embedded browsers — use redirect. */
export function shouldUseGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;

  if (isPlayStoreV1Shell()) return true;

  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return true;

  return false;
}

export const GOOGLE_AUTH_PENDING_KEY = 'grabio_invoice_google_auth_pending';

export function markGoogleAuthPending(): void {
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, '1');
}

export function clearGoogleAuthPending(): void {
  sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
}

export function isGoogleAuthPending(): boolean {
  return sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY) === '1';
}

export function authCallbackUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${window.location.origin}${normalized}auth/callback`;
}
