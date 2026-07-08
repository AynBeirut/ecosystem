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
