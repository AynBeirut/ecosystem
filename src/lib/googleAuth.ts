/** Redirect only on mobile / dev. Desktop grabio.space uses popup (COOP warnings are benign). */
export function shouldUseGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
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
