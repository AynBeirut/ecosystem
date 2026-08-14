import {
  buildStorePublicUrl,
  buildStoreRelativePath,
  isOnStoreSubdomain,
  storeSlugFromHostname,
} from '@/lib/storeUrls';

type StoreLinkProduct = {
  storeId?: string;
  store?: { slug?: string; name?: string };
};

type StoreLinkItem = {
  product: StoreLinkProduct;
};

const RESERVED_FIRST_SEGMENTS = new Set([
  'search',
  'marketplace',
  'cart',
  'login',
  'register',
  'admin',
  'product',
  'orders',
  'track-order',
  'favorites',
  'contact',
  'home',
  'features',
  'pricing',
  'about',
  'blog',
  'careers',
  'solutions',
  'onboarding',
  'builder',
  'subscription',
  'blocked',
  'team',
  'store',
]);

export function storeSlugFromPath(pathname: string): string | undefined {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment || RESERVED_FIRST_SEGMENTS.has(segment)) return undefined;
  return segment;
}

function uniqueStoreSlugs(products: StoreLinkProduct[]): string[] {
  return [...new Set(products.map((p) => p.store?.slug?.trim()).filter(Boolean) as string[])];
}

export function resolveStoreShopUrl(options: {
  pathname?: string;
  items?: StoreLinkItem[];
  products?: StoreLinkProduct[];
  storeSlug?: string;
  storeId?: string;
}): string {
  if (options.storeSlug?.trim()) {
    return buildStoreRelativePath(options.storeSlug.trim(), '/');
  }

  const hostSlug = typeof window !== 'undefined' ? storeSlugFromHostname(window.location.hostname) : undefined;
  if (hostSlug) return '/';

  const fromPath = options.pathname ? storeSlugFromPath(options.pathname) : undefined;
  if (fromPath) return buildStorePublicUrl(fromPath);

  const catalogProducts =
    options.products ||
    options.items?.map((item) => item.product) ||
    [];

  const slugs = uniqueStoreSlugs(catalogProducts);
  if (slugs.length === 1) return buildStorePublicUrl(slugs[0]);

  const storeIds = [...new Set(catalogProducts.map((p) => p.storeId).filter(Boolean) as string[])];
  if (storeIds.length === 1 && slugs.length === 0) {
    return buildStorePublicUrl(storeIds[0]);
  }

  if (options.storeId?.trim()) {
    return buildStorePublicUrl(options.storeId.trim());
  }

  return '/search';
}

export function resolveStoreShopLabel(url: string): string {
  if (url === '/search') return 'Go to Marketplace';
  if (url === '/' || isOnStoreSubdomain()) return 'Back to Store';
  return 'Back to Store';
}

export { buildStorePublicUrl, buildStoreRelativePath };
