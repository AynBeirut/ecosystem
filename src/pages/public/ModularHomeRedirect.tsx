import { useEffect } from 'react';

/** Sends `/` to the static modular landing page (same Firebase auth session). */
export default function ModularHomeRedirect() {
  useEffect(() => {
    window.location.replace('/home.html');
  }, []);
  return null;
}
