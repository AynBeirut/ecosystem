/** Firebase Hosting preview channels (e.g. `--staging-xxx.web.app`). */
export function isFirebasePreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  return /^market-flow-7b074--[a-z0-9-]+\.web\.app$/i.test(window.location.hostname);
}

/** Popup sign-in on all hosts — redirect is unreliable on Firebase preview channels. */
export function shouldUseGoogleRedirect(): boolean {
  return false;
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
