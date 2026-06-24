/** Prefer full-page redirect over popup (popup breaks in embedded browsers / COOP). */
export function shouldUseGoogleRedirect(): boolean {
  if (import.meta.env.DEV) return true;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return host === 'localhost' || host === '127.0.0.1';
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
