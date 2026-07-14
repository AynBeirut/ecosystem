/** Prefer full-page redirect over popup (popup breaks under COOP / embedded browsers). */
export function shouldUseGoogleRedirect(): boolean {
  return true;
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
