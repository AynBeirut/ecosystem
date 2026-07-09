/** Maps admin route prefixes to required module IDs for gating */

export type ModuleRouteRule = {
  pathPrefix: string;
  moduleId: string;
  /** When true, gate only if VITE_ECOSYSTEM_ENFORCE_MODULES is on */
  enforceOnly?: boolean;
};

export const MODULE_ROUTE_MAP: ModuleRouteRule[] = [
  { pathPrefix: '/admin/orders', moduleId: 'invoicing', enforceOnly: true },
  { pathPrefix: '/admin/analytics', moduleId: 'analytics', enforceOnly: true },
  { pathPrefix: '/admin/revenue', moduleId: 'analytics', enforceOnly: true },
  { pathPrefix: '/admin/reports', moduleId: 'analytics', enforceOnly: true },
  { pathPrefix: '/admin/account-statement', moduleId: 'analytics', enforceOnly: true },
  { pathPrefix: '/admin/payments', moduleId: 'payments', enforceOnly: true },
  { pathPrefix: '/admin/expenses', moduleId: 'payments', enforceOnly: true },
  { pathPrefix: '/admin/finance', moduleId: 'payments', enforceOnly: true },
  { pathPrefix: '/admin/cash-collection', moduleId: 'payments', enforceOnly: true },
  { pathPrefix: '/admin/bank-reconciliation', moduleId: 'payments', enforceOnly: true },
  { pathPrefix: '/admin/delivery', moduleId: 'delivery', enforceOnly: true },
  { pathPrefix: '/admin/announcements', moduleId: 'marketplace', enforceOnly: true },
  { pathPrefix: '/admin/product-reviews', moduleId: 'marketplace', enforceOnly: true },
  { pathPrefix: '/admin/products', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/inventory', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/purchases', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/suppliers', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/supplier-statements', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/returns', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/supplier-returns', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/sales-returns', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/supplier-credits', moduleId: 'stock', enforceOnly: true },
  { pathPrefix: '/admin/crm', moduleId: 'crm' },
  { pathPrefix: '/team/crm', moduleId: 'crm' },
  { pathPrefix: '/admin/production', moduleId: 'factory', enforceOnly: true },
  { pathPrefix: '/admin/finished-goods', moduleId: 'factory', enforceOnly: true },
  { pathPrefix: '/admin/raw-materials', moduleId: 'factory', enforceOnly: true },
  { pathPrefix: '/admin/recipes', moduleId: 'restaurant', enforceOnly: true },
  { pathPrefix: '/admin/composed-products', moduleId: 'restaurant', enforceOnly: true },
  { pathPrefix: '/admin/marketplace', moduleId: 'dropship', enforceOnly: true },
  { pathPrefix: '/admin/service-renewals', moduleId: 'services', enforceOnly: true },
  { pathPrefix: '/admin/sub-accounts', moduleId: 'team', enforceOnly: true },
  { pathPrefix: '/admin/finance/invoices', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/finance/estimates', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/finance/receipts', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/finance/clients', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/finance/products', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/finance/reports', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/finance/portfolio', moduleId: 'invoice_manager', enforceOnly: true },
  { pathPrefix: '/admin/projects', moduleId: 'projects', enforceOnly: true },
  { pathPrefix: '/admin/builder', moduleId: 'builder', enforceOnly: true },
  { pathPrefix: '/admin/templates', moduleId: 'builder', enforceOnly: true },
  { pathPrefix: '/admin/blog', moduleId: 'blog_publisher', enforceOnly: true },
  { pathPrefix: '/admin/whitelabel', moduleId: 'whitelabel', enforceOnly: true },
  { pathPrefix: '/admin/ai-builder', moduleId: 'ai_builder', enforceOnly: true },
  { pathPrefix: '/admin/pos', moduleId: 'pos', enforceOnly: true },
  { pathPrefix: '/admin/ai/content-creator', moduleId: 'content_creator', enforceOnly: true },
  { pathPrefix: '/admin/ai/market-strategy', moduleId: 'market_strategy', enforceOnly: true },
  { pathPrefix: '/admin/ai/proposal-writer', moduleId: 'proposal_writer', enforceOnly: true },
  { pathPrefix: '/admin/ai/seo-assistant', moduleId: 'seo_assistant', enforceOnly: true },
  { pathPrefix: '/admin/ai/business-insights', moduleId: 'analytics_insights', enforceOnly: true },
  { pathPrefix: '/admin/ai/campaign-writer', moduleId: 'campaign_writer', enforceOnly: true },
];

export function moduleForPath(pathname: string): string | null {
  const matches = MODULE_ROUTE_MAP.filter((r) => pathname.startsWith(r.pathPrefix));
  if (!matches.length) return null;
  matches.sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
  return matches[0].moduleId;
}

export function navItemsForModules(modules: Record<string, boolean>): Set<string> {
  const allowed = new Set<string>();
  MODULE_ROUTE_MAP.forEach((rule) => {
    if (modules[rule.moduleId]) {
      allowed.add(rule.pathPrefix);
    }
  });
  return allowed;
}
