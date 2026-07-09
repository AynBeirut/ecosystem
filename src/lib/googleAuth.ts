/** Prefer full-page redirect over popup (popup breaks on custom domain / COOP). */
export function shouldUseGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (import.meta.env.DEV) return true;
  return host === 'grabio.space' || host === 'www.grabio.space' || host.endsWith('.grabio.space');
}

export const GOOGLE_AUTH_PENDING_KEY = 'grabio_google_auth_pending';

export function markGoogleAuthPending(): void {
  sessionStorage.setItem(GOOGLE_AUTH_PENDING_KEY, '1');
}

export function clearGoogleAuthPending(): void {
  sessionStorage.removeItem(GOOGLE_AUTH_PENDING_KEY);
}

export function isGoogleAuthPending(): boolean {
  return sessionStorage.getItem(GOOGLE_AUTH_PENDING_KEY) === '1';
}
