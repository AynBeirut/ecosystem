import { getCookieConsent } from '@/components/CookieConsent';

const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined;

let initialized = false;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function initGTM(): void {
  if (!GTM_ID || initialized || typeof window === 'undefined') return;
  if (getCookieConsent() !== 'accepted') return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
  initialized = true;
}

export function pushDataLayer(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  window.dataLayer.push({ event, ...params });
}

/** Marketing-site conversion events (Meta + GA4 via GTM when configured). */
export function trackMarketingLead(source: string): void {
  pushDataLayer('generate_lead', { lead_source: source });
}

export function trackMarketingSignupIntent(source: string): void {
  pushDataLayer('sign_up_intent', { signup_source: source });
}

export function trackSolutionView(slug: string, title: string): void {
  pushDataLayer('view_solution', { solution_slug: slug, solution_title: title });
}
