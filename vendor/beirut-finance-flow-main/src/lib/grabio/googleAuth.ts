/** Full-page redirect — avoids COOP / popup console errors on Firebase Hosting. */
export function shouldUseGoogleRedirect(): boolean {
  return typeof window !== 'undefined';
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
