import ReactGA from 'react-ga4';
import { getCookieConsent } from '../components/CookieConsent';

const GA_ID = import.meta.env.VITE_GA4_ID as string | undefined;

let initialized = false;

export function initGA(): void {
  if (!GA_ID || initialized || getCookieConsent() !== 'accepted') return;
  ReactGA.initialize(GA_ID);
  initialized = true;
}

export function trackPageView(path: string): void {
  if (!initialized) return;
  ReactGA.send({ hitType: 'pageview', page: path });
}

export function trackEvent(category: string, action: string, label?: string): void {
  if (!initialized) return;
  ReactGA.event({ category, action, label });
}
