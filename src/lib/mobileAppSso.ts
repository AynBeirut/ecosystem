import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

declare global {
  interface Window {
    __GRABIO_MOBILE_SSO_TOKEN__?: string;
  }
}

let mobileSsoAttempted = false;

/** Sign in from Grabio Admin mobile WebView (invoice / CRM shells). */
export async function consumeMobileSsoToken(): Promise<boolean> {
  if (mobileSsoAttempted || auth.currentUser) return false;
  const token = window.__GRABIO_MOBILE_SSO_TOKEN__;
  if (!token || typeof token !== 'string') return false;
  mobileSsoAttempted = true;
  try {
    await signInWithCustomToken(auth, token);
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[mobile-sso] custom token sign-in failed', err);
    }
    return false;
  }
}
