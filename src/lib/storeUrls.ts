import { isPlatformHostname } from '@/lib/platformHosts';
import { generateSlug } from '@/lib/slugify';

export const GRABIO_ROOT_DOMAIN = 'grabio.space';

/** True on {slug}.grabio.space or an external store custom domain — hide Grabio chrome. */
export function isStoreBrandedHost(hostname: string): boolean {
  if (!hostname) return false;
  return isGrabioStoreSubdomain(hostname) || !isPlatformHostname(hostname);
}
const STORE_SUBDOMAIN_SUFFIX = `.${GRABIO_ROOT_DOMAIN}`;

export function isGrabioStoreSubdomain(hostname: string): boolean {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  if (!lower.endsWith(STORE_SUBDOMAIN_SUFFIX)) return false;
  const sub = lower.slice(0, -STORE_SUBDOMAIN_SUFFIX.length);
  if (!sub || sub === 'www' || sub.includes('.')) return false;
  return true;
}

/** Relative router path to store home (works on subdomain and platform). */
export function buildStoreRootPath(storeSlug: string): string {
  if (!storeSlug?.trim()) return '/';
  return isOnStoreSubdomain(storeSlug) ? '/' : `/store/${storeSlug.trim().toLowerCase()}`;
}

/** Relative router path for all products listing (not store home). */
export function buildStoreProductsPath(storeSlug: string): string {
  const root = buildStoreRootPath(storeSlug);
  const base = root === '/' ? '' : root;
  return `${base}/products`;
}

/** Relative router path for all products or a category listing. */
export function buildStoreCategoryPath(storeSlug: string, category?: string | null): string {
  const root = buildStoreRootPath(storeSlug);
  if (!category?.trim()) return root;
  const base = root === '/' ? '' : root;
  return `${base}/category/${generateSlug(category)}`;
}

/** Store tab paths for home / products / contact / about (storefront nav). */
export function buildStoreTabPath(
  storeSlug: string,
  tab: 'home' | 'products' | 'contact' | 'about',
): string {
  if (tab === 'products') return buildStoreProductsPath(storeSlug);
  const root = buildStoreRootPath(storeSlug);
  const query = tab === 'home' ? 'view=home' : `view=${tab}`;
  if (root === '/') return `/?${query}`;
  return `${root}?${query}`;
}

export type StoreMobileNavLink = { label: string; path: string };

type StoreMobileNavInput = {
  slug?: string | null;
  aboutUs?: string | null;
  mission?: string | null;
  vision?: string | null;
  contactInfo?: { phone?: string; email?: string } | null;
  location?: string | null;
  website?: string | null;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  } | null;
  customPages?: Array<{ id: string; name: string; order: number }> | null;
  enabledModules?: { blog_publisher?: boolean } | null;
};

/** Header mobile menu links — mirrors storefront tab bar (Home, Products, Reserve, etc.). */
export function buildStoreMobileNavLinks(
  store: StoreMobileNavInput,
  contactPageLabel: string,
): StoreMobileNavLink[] {
  const slug = store.slug?.trim();
  if (!slug) return [];

  const hasAbout = !!(store.aboutUs || store.mission || store.vision);
  const hasContact = !!(
    store.contactInfo?.phone
    || store.contactInfo?.email
    || store.location
    || store.website
    || store.socialLinks?.facebook
    || store.socialLinks?.instagram
    || store.socialLinks?.twitter
    || store.socialLinks?.whatsapp
  );
  const customPages = Array.isArray(store.customPages)
    ? [...store.customPages].sort((a, b) => a.order - b.order)
    : [];

  const links: StoreMobileNavLink[] = [
    { label: 'Home', path: buildStoreTabPath(slug, 'home') },
  ];
  if (hasAbout) links.push({ label: 'About Us', path: buildStoreTabPath(slug, 'about') });
  links.push({ label: 'Products', path: buildStoreTabPath(slug, 'products') });
  for (const page of customPages) {
    links.push({
      label: page.name,
      path: buildStoreCustomPagePath(slug, page.id),
    });
  }
  if (hasContact) links.push({ label: contactPageLabel, path: buildStoreTabPath(slug, 'contact') });
  if (store.enabledModules?.blog_publisher) {
    links.push({ label: 'Blog', path: buildStoreRelativePath(slug, '/blog') });
  }
  return links;
}

function buildStoreCustomPagePath(storeSlug: string, pageId: string): string {
  const root = buildStoreRootPath(storeSlug);
  const query = `view=${encodeURIComponent(pageId)}`;
  if (root === '/') return `/?${query}`;
  return `${root}?${query}`;
}

export function storeSlugFromHostname(hostname: string): string | undefined {
  if (!isGrabioStoreSubdomain(hostname)) return undefined;
  return hostname.toLowerCase().replace(/\.grabio\.space$/i, '');
}

/** Raw Firebase doc id / auth uid — not a marketing subdomain. */
export function isLikelyFirebaseUid(value: string): boolean {
  const v = String(value || '').trim();
  if (!v || v.includes('-')) return false;
  return /^[A-Za-z0-9]{20,32}$/.test(v);
}

export function isFriendlyStoreSlug(value: string): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  return !isLikelyFirebaseUid(v);
}

/** Prefer slug subdomain; fall back to platform /store/id/{id} when no friendly slug. */
export function buildStorePublicUrlFromStore(
  store: { id: string; slug?: string | null },
  path: string = '/',
): string {
  const slug = store.slug?.trim();
  if (slug && isFriendlyStoreSlug(slug)) {
    return buildStorePublicUrl(slug, path);
  }
  const normalizedPath = path && path !== '/'
    ? (path.startsWith('/') ? path : `/${path}`)
    : '';
  return `https://${GRABIO_ROOT_DOMAIN}/store/id/${store.id}${normalizedPath}`;
}

/** Canonical public store URL: https://{slug}.grabio.space */
export function buildStorePublicUrl(slug: string, path: string = '/'): string {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  if (!cleanSlug) return `https://${GRABIO_ROOT_DOMAIN}`;
  if (!isFriendlyStoreSlug(cleanSlug)) {
    return `https://${GRABIO_ROOT_DOMAIN}/store/id/${slug}${path === '/' ? '' : (path.startsWith('/') ? path : `/${path}`)}`;
  }
  const normalizedPath = path && path !== '/'
    ? (path.startsWith('/') ? path : `/${path}`)
    : '';
  return `https://${cleanSlug}${STORE_SUBDOMAIN_SUFFIX}${normalizedPath}`;
}

/** @deprecated Use buildStorePublicUrl — kept as alias */
export function buildStoreShareUrl(slug: string, path: string = '/'): string {
  return buildStorePublicUrl(slug, path);
}

/** QR / share link for store home or a specific product page. */
export function buildStoreQrTargetUrl(
  storeSlug: string,
  destination: 'home' | 'product',
  productSlug?: string,
): string {
  if (destination === 'product' && productSlug?.trim()) {
    return buildStorePublicUrl(storeSlug, `/product/${productSlug.trim()}`);
  }
  return buildStorePublicUrl(storeSlug);
}

export function buildStoreQrCodeUrl(publicStoreUrl: string, size = 320): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(publicStoreUrl)}`;
}

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function buildStoreRelativePath(slug: string | undefined, subpath: string = '/'): string {
  if (!slug?.trim()) return subpath.startsWith('/') ? subpath : `/${subpath}`;

  const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`;

  if (typeof window !== 'undefined') {
    const hostSlug = storeSlugFromHostname(window.location.hostname);
    if (hostSlug === slug.trim().toLowerCase()) {
      return normalized;
    }
  }

  return buildStorePublicUrl(slug, normalized);
}

export function isOnStoreSubdomain(slug?: string): boolean {
  if (!slug || typeof window === 'undefined') return false;
  return storeSlugFromHostname(window.location.hostname) === slug.trim().toLowerCase();
}

export function redirectToStoreSubdomain(slug: string, path: string = '/'): void {
  if (typeof window === 'undefined') return;
  const target = buildStorePublicUrl(slug, path);
  if (window.location.href === target) return;
  window.location.replace(target);
}

export function navigateToStorePath(
  slug: string | undefined,
  subpath: string,
  navigate: (path: string) => void,
): void {
  const target = buildStoreRelativePath(slug, subpath);
  if (isExternalUrl(target)) {
    window.location.href = target;
    return;
  }
  navigate(target);
}

/** Storefront product link — slug when available, else doc id (POS-synced SKUs). */
export function buildProductRelativePath(
  product: { id: string; slug?: string | null },
  storeSlug?: string | null,
): string {
  const slug = storeSlug?.trim();
  if (product.slug?.trim() && slug) {
    return buildStoreRelativePath(slug, `/product/${product.slug.trim()}`);
  }
  if (slug) {
    return buildStoreRelativePath(slug, `/product/id/${product.id}`);
  }
  return `/product/id/${product.id}`;
}
