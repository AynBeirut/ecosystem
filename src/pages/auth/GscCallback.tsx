/**
 * GscCallback.tsx
 * ───────────────
 * OAuth 2.0 redirect handler for Google Search Console.
 * Google redirects here after user grants permission (implicit flow).
 * Extracts access_token from URL hash and postMessages it back to the opener.
 */

import { useEffect } from 'react';

export default function GscCallback() {
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const token     = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
    const error     = params.get('error');

    if (window.opener) {
      if (token) {
        window.opener.postMessage(
          { type: 'GSC_TOKEN', token, expiresIn },
          window.location.origin,
        );
      } else {
        window.opener.postMessage(
          { type: 'GSC_ERROR', error: error || 'No token returned' },
          window.location.origin,
        );
      }
      window.close();
    } else {
      // Fallback: redirect to admin SEO audit if not opened as popup
      window.location.replace('/admin/seo-audit');
    }
  }, []);

  return null;
}
