/** Staging hostnames for builder demo WordPress — must resolve to the VPS (wildcard DNS). */
export const WORDPRESS_DEMO_DOMAIN_SUFFIX = 'demo.grabio.online';

export function sanitizeWordPressDemoSlug(raw: string): string {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return value.slice(0, 24) || 'demo';
}

/** Unique staging hostname per demo — not a client go-live domain. */
export function buildWordPressDemoStagingDomain(slug: string, demoId: string): string {
  const base = sanitizeWordPressDemoSlug(slug);
  const shortId = String(demoId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toLowerCase();
  return `${base}-${shortId}.${WORDPRESS_DEMO_DOMAIN_SUFFIX}`;
}

export function isWordPressDemoStagingDomain(domain?: string | null): boolean {
  if (!domain) return false;
  const suffix = `.${WORDPRESS_DEMO_DOMAIN_SUFFIX}`.toLowerCase();
  return domain.trim().toLowerCase().endsWith(suffix);
}
