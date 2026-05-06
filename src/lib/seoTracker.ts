/**
 * Grabio SEO / Public Site Analytics Tracker
 * Self-contained — writes directly to Firestore, no third-party analytics.
 * All writes are fire-and-forget (never block the UI).
 */

import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type SeoEventName =
  | 'page_view'
  | 'unique_visit'
  | 'cta_click'
  | 'click_whatsapp'
  | 'click_call'
  | 'lead_submit';

// ─── Session & Source ──────────────────────────────────────────────────────────

function getSessionId(): string {
  const key = 'grabio_sid';
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

function detectSource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    if (utm) return utm;
    if (params.get('gclid')) return 'google_ads';
    if (params.get('fbclid')) return 'facebook_ads';

    const ref = document.referrer;
    if (!ref) return 'direct';

    const refHost = new URL(ref).hostname;
    const engines = ['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'yandex.', 'baidu.'];
    if (engines.some((e) => refHost.includes(e))) return 'organic';
    return 'referral';
  } catch {
    return 'direct';
  }
}

// ─── Core tracker ─────────────────────────────────────────────────────────────

export function trackSEOEvent(
  eventName: SeoEventName,
  options: {
    userId?: string | null;
    label?: string;
    extra?: Record<string, string>;
  } = {}
): void {
  // Completely non-blocking — fire-and-forget, never await
  void (async () => {
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'seo_events'), {
        event_name: eventName,
        page_path: window.location.pathname,
        source: detectSource(),
        session_id: getSessionId(),
        user_id: options.userId ?? null,
        referrer: document.referrer || null,
        label: options.label ?? null,
        ...options.extra,
        created_at: serverTimestamp(),
      });
    } catch {
      // Silent fail — analytics must never break the app
    }
  })();
}

// ─── Unique visit (fires once per session) ────────────────────────────────────

export function trackUniqueVisit(userId?: string | null): void {
  const key = 'grabio_uv';
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  trackSEOEvent('unique_visit', { userId });
}

// ─── Lead tracking ────────────────────────────────────────────────────────────

export interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source_page?: string;
}

export function trackLeadSubmit(leadData: LeadData, userId?: string | null): void {
  void (async () => {
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'seo_leads'), {
        ...leadData,
        source_page: leadData.source_page ?? window.location.pathname,
        session_id: getSessionId(),
        source: detectSource(),
        user_id: userId ?? null,
        created_at: serverTimestamp(),
      });
      trackSEOEvent('lead_submit', { userId, label: leadData.email ?? undefined });
    } catch {
      // Silent fail
    }
  })();
}

// ─── Convenience shorthands ───────────────────────────────────────────────────

export const trackCTAClick = (label: string, userId?: string | null): void =>
  trackSEOEvent('cta_click', { userId, label });

export const trackWhatsAppClick = (userId?: string | null): void =>
  trackSEOEvent('click_whatsapp', { userId });

export const trackCallClick = (userId?: string | null): void =>
  trackSEOEvent('click_call', { userId });
