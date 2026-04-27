const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

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

let initialized = false;

export function initMetaPixel(): void {
  if (!PIXEL_ID || initialized || typeof window === 'undefined') return;
  // Respect GDPR consent
  try {
    if (localStorage.getItem('grabio_cookie_consent') !== 'accepted') return;
  } catch { return; }

  // Inject fbq stub
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

  // Inject pixel script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
  initialized = true;
}

export function pixelPageView(): void {
  if (!initialized || !window.fbq) return;
  window.fbq('track', 'PageView');
}

export function pixelViewContent(params: {
  contentId: string;
  contentName: string;
  contentType?: string;
  value?: number;
  currency?: string;
}): void {
  if (!initialized || !window.fbq) return;
  window.fbq('track', 'ViewContent', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    content_type: params.contentType || 'product',
    value: params.value,
    currency: params.currency || 'USD',
  });
}

export function pixelAddToCart(params: {
  contentId: string;
  contentName: string;
  value: number;
  currency?: string;
}): void {
  if (!initialized || !window.fbq) return;
  window.fbq('track', 'AddToCart', {
    content_ids: [params.contentId],
    content_name: params.contentName,
    value: params.value,
    currency: params.currency || 'USD',
  });
}

export function pixelPurchase(params: {
  value: number;
  currency?: string;
  contentIds?: string[];
}): void {
  if (!initialized || !window.fbq) return;
  window.fbq('track', 'Purchase', {
    value: params.value,
    currency: params.currency || 'USD',
    content_ids: params.contentIds || [],
  });
}
