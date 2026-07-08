declare global {
  interface Window {
    __GRABIO_MOBILE_SSO_TOKEN__?: string;
  }
}

/** Token injected by Grabio Admin WebView before the finance app boots. */
export function consumeMobileSsoToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = window.__GRABIO_MOBILE_SSO_TOKEN__;
  delete window.__GRABIO_MOBILE_SSO_TOKEN__;
  return token?.trim() || null;
}

export function isInAppShell(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      sessionStorage.getItem('grabio-finance-play-app') === '1' ||
      localStorage.getItem('grabio-finance-play-app') === '1' ||
      sessionStorage.getItem('grabio-admin-app-shell') === '1' ||
      localStorage.getItem('grabio-admin-app-shell') === '1'
    );
  } catch {
    return false;
  }
}
