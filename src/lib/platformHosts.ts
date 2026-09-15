/** Hostnames that run the full Grabio platform app (not a single-store custom domain). */

const PLATFORM_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'grabio.space',
  'www.grabio.space',
  'market-flow-7b074.web.app',
  'market-flow-7b074.firebaseapp.com',
]);

/** Firebase Hosting preview channels: `{site}--{channel}-{id}.web.app` */
const FIREBASE_PREVIEW_CHANNEL = /^market-flow-7b074--[a-z0-9-]+\.web\.app$/i;

export function isPlatformHostname(hostname: string): boolean {
  if (!hostname) return true;
  if (PLATFORM_HOSTS.has(hostname)) return true;
  if (FIREBASE_PREVIEW_CHANNEL.test(hostname)) return true;
  return false;
}

/** First-segment paths served by the platform app — never treat as store slugs. */
export const PLATFORM_ROUTE_SLUGS = new Set([
  'home',
  'features',
  'pricing',
  'search',
  'marketplace',
  'login',
  'signup',
  'admin',
  'contact',
  'cart',
  'favorites',
  'blog',
  'about',
  'careers',
  'solutions',
  'demo',
  'compare',
  'demoshop',
  'privacy',
  'freelancer',
  'builder',
  'team',
  'store',
  'product',
  'orders',
  'profile',
  'upgrade',
  'onboarding',
  'payment',
  'blocked',
  'auth',
  'invoice',
  'pages',
  'wordpress',
  'use-cases',
  'track-order',
  'resources',
]);
