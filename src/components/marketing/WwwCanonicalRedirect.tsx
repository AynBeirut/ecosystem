import { useEffect } from 'react';

const CANONICAL_ORIGIN = 'https://grabio.space';

/**
 * Interim www → non-www redirect until Firebase Hosting "redirect domain" is set in console.
 * Uses replace() so back button does not return to www.
 */
const WwwCanonicalRedirect: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { hostname, pathname, search, hash } = window.location;
    if (hostname !== 'www.grabio.space') return;
    window.location.replace(`${CANONICAL_ORIGIN}${pathname}${search}${hash}`);
  }, []);

  return null;
};

export default WwwCanonicalRedirect;
