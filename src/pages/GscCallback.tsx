/**
 * GscCallback.tsx
 * Handles the Google OAuth redirect for the GSC implicit flow.
 * This page is loaded inside the popup window after Google auth.
 * It reads the access_token from the URL hash and posts it to the opener.
 */
import { useEffect } from 'react';

const GscCallback = () => {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token     = params.get('access_token');
    const expiresIn = params.get('expires_in');
    const error     = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        token
          ? { type: 'GSC_TOKEN', token, expiresIn: parseInt(expiresIn || '3600', 10) }
          : { type: 'GSC_ERROR', error: error || 'no_token' },
        window.location.origin,
      );
    }
    window.close();
  }, []);

  return null;
};

export default GscCallback;
