/** Static grabio.space marketing URLs included in the dynamic platform sitemap. */

export type PlatformSitemapEntry = {
  path: string;
  priority: string;
  changefreq?: string;
};

export const PLATFORM_STATIC_SITEMAP: PlatformSitemapEntry[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/features', priority: '0.9', changefreq: 'monthly' },
  { path: '/pricing', priority: '0.9', changefreq: 'monthly' },
  { path: '/use-cases', priority: '0.8', changefreq: 'monthly' },
  { path: '/about', priority: '0.7', changefreq: 'monthly' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.4', changefreq: 'yearly' },
  { path: '/marketplace', priority: '0.8', changefreq: 'daily' },
  { path: '/login', priority: '0.5', changefreq: 'yearly' },
  { path: '/signup', priority: '0.6', changefreq: 'yearly' },
  { path: '/careers', priority: '0.6', changefreq: 'monthly' },
  { path: '/solutions', priority: '0.95', changefreq: 'weekly' },
  { path: '/solutions/inventory', priority: '0.9', changefreq: 'monthly' },
  { path: '/solutions/accounting', priority: '0.9', changefreq: 'monthly' },
  { path: '/solutions/pos', priority: '0.9', changefreq: 'monthly' },
  { path: '/solutions/mobile-apps', priority: '0.9', changefreq: 'monthly' },
  { path: '/solutions/crm-psa', priority: '0.85', changefreq: 'monthly' },
  { path: '/solutions/restaurant', priority: '0.85', changefreq: 'monthly' },
  { path: '/solutions/manufacturing', priority: '0.85', changefreq: 'monthly' },
  { path: '/solutions/ai', priority: '0.85', changefreq: 'monthly' },
  { path: '/solutions/platform', priority: '0.8', changefreq: 'monthly' },
  { path: '/blog', priority: '0.8', changefreq: 'weekly' },
  { path: '/blog/business-management-software-small-business', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/pos-systems-for-small-business-guide', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/invoicing-billing-software-guide', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/commerce-management-system-guide', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/ai-business-operations-tools', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/automate-business-workflow', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/multi-location-inventory-lebanon', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/weighted-average-costing-smb', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/purchase-order-workflow', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/low-stock-alerts-setup', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/pos-inventory-sync', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/lebanese-pcg-small-business', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/general-ledger-vs-bookkeeping', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/ap-aging-report-walkthrough', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/bank-reconciliation-checklist', priority: '0.7', changefreq: 'monthly' },
  { path: '/blog/vat-filing-prep-lebanon', priority: '0.7', changefreq: 'monthly' },
];
