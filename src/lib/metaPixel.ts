import { isGrabioMarketingCatalogId } from '@/lib/grabioMetaCatalog';
import { isPlatformHostname } from '@/lib/platformHosts';

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const META_API_URL = (import.meta.env.VITE_API_URL || 'https://us-central1-market-flow-7b074.cloudfunctions.net/api').replace(/\/$/, '');

function marketingPixelSkipsProductContentIds(contentId: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!isPlatformHostname(window.location.hostname)) return false;
  return !isGrabioMarketingCatalogId(contentId);
}

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqFunction;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

let marketingPixelInitialized = false;
const storePixelsInitialized = new Set<string>();

/** Must match Meta catalog feed `id` / `retailer_id` (Firestore products doc id). */
export function metaCatalogContentId(productId: string | undefined | null): string {
  return String(productId || '').trim();
}

export function metaCatalogContentIds(productIds: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of productIds) {
    const id = metaCatalogContentId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function hasMetaCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('grabio_cookie_consent') === 'accepted';
  } catch {
    return false;
  }
}

function ensureFbqStub(): FbqFunction | null {
  if (typeof window === 'undefined') return null;
  if (window.fbq) return window.fbq;

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }
    fbq.queue.push(args);
  }) as FbqFunction;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  return fbq;
}

function canSendBrowserPixelEvent(): boolean {
  return hasMetaCookieConsent() && Boolean(window.fbq);
}

/** Grabio marketing site pixel (env). */
export function initMetaPixel(): void {
  if (!PIXEL_ID || marketingPixelInitialized || typeof window === 'undefined') return;
  if (!hasMetaCookieConsent()) return;

  ensureFbqStub();
  if (!window.fbq) return;

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
  marketingPixelInitialized = true;
}

/** Per-store pixel from storeProfiles.metaIntegrationSettings — required for catalog match on storefronts. */
export function initStoreMetaPixel(pixelId: string | undefined | null): void {
  const id = String(pixelId || '').trim();
  if (!id || typeof window === 'undefined') return;
  if (!hasMetaCookieConsent()) return;
  if (storePixelsInitialized.has(id)) return;

  ensureFbqStub();
  if (!window.fbq) return;

  window.fbq('init', id);
  window.fbq('track', 'PageView');
  storePixelsInitialized.add(id);
}

export function pixelPageView(): void {
  if (!canSendBrowserPixelEvent()) return;
  window.fbq!('track', 'PageView');
}

export function pixelViewContent(params: {
  contentId: string;
  contentName: string;
  contentType?: string;
  value?: number;
  currency?: string;
}): void {
  const contentId = metaCatalogContentId(params.contentId);
  if (!contentId || !canSendBrowserPixelEvent()) return;
  if (marketingPixelSkipsProductContentIds(contentId)) return;
  window.fbq!('track', 'ViewContent', {
    content_ids: [contentId],
    content_name: params.contentName,
    content_type: params.contentType || 'product',
    value: params.value,
    currency: params.currency || 'USD',
    contents: [{ id: contentId, quantity: 1 }],
  });
}

export function pixelAddToCart(params: {
  contentId: string;
  contentName: string;
  value: number;
  currency?: string;
}): void {
  const contentId = metaCatalogContentId(params.contentId);
  if (!contentId || !canSendBrowserPixelEvent()) return;
  if (marketingPixelSkipsProductContentIds(contentId)) return;
  window.fbq!('track', 'AddToCart', {
    content_ids: [contentId],
    content_name: params.contentName,
    content_type: 'product',
    value: params.value,
    currency: params.currency || 'USD',
    contents: [{ id: contentId, quantity: 1 }],
  });
}

export function pixelInitiateCheckout(params: {
  value: number;
  currency?: string;
  contentIds?: string[];
}): void {
  const contentIds = metaCatalogContentIds(params.contentIds || []);
  if (!canSendBrowserPixelEvent()) return;
  const filtered =
    typeof window !== 'undefined' && isPlatformHostname(window.location.hostname)
      ? contentIds.filter((id) => isGrabioMarketingCatalogId(id))
      : contentIds;
  if (typeof window !== 'undefined' && isPlatformHostname(window.location.hostname) && filtered.length === 0) {
    return;
  }
  window.fbq!('track', 'InitiateCheckout', {
    value: params.value,
    currency: params.currency || 'USD',
    content_ids: filtered,
    content_type: 'product',
    ...(filtered.length > 0
      ? { contents: filtered.map((id) => ({ id, quantity: 1 })) }
      : {}),
  });
}

export function pixelPurchase(params: {
  value: number;
  currency?: string;
  contentIds?: string[];
}): void {
  const contentIds = metaCatalogContentIds(params.contentIds || []);
  if (!canSendBrowserPixelEvent()) return;
  const filtered =
    typeof window !== 'undefined' && isPlatformHostname(window.location.hostname)
      ? contentIds.filter((id) => isGrabioMarketingCatalogId(id))
      : contentIds;
  if (typeof window !== 'undefined' && isPlatformHostname(window.location.hostname) && filtered.length === 0) {
    return;
  }
  window.fbq!('track', 'Purchase', {
    value: params.value,
    currency: params.currency || 'USD',
    content_ids: filtered,
    content_type: 'product',
    ...(filtered.length > 0
      ? { contents: filtered.map((id) => ({ id, quantity: 1 })) }
      : {}),
  });
}

function compactUserData(
  userData?: {
    email?: string;
    phone?: string;
    externalId?: string;
  },
): Record<string, string> | undefined {
  if (!userData) return undefined;
  const out: Record<string, string> = {};
  const email = String(userData.email || '').trim();
  const phone = String(userData.phone || '').trim();
  const externalId = String(userData.externalId || '').trim();
  if (email) out.email = email;
  if (phone) out.phone = phone;
  if (externalId) out.externalId = externalId;
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function trackMetaConversionEvent(params: {
  storeId: string;
  eventName: 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';
  eventId?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  userData?: {
    email?: string;
    phone?: string;
    externalId?: string;
  };
}): Promise<void> {
  if (!params.storeId || !params.eventName) return;

  const contentIds = metaCatalogContentIds(params.contentIds || []);

  try {
    const userData = compactUserData(params.userData);
    const response = await fetch(`${META_API_URL}/meta/conversion/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: params.storeId,
        eventName: params.eventName,
        eventId: params.eventId,
        value: params.value,
        currency: params.currency || 'USD',
        contentIds,
        contentName: params.contentName,
        eventSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
        ...(userData ? { userData } : {}),
      }),
      keepalive: true,
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('Meta conversion API rejected event', response.status, text);
    }
  } catch (error) {
    console.warn('Meta conversion API call failed', error);
  }
}
