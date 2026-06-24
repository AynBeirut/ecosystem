import { MODULE_CATALOG, PricingModule, getModulePriceLabel, type PaidTier } from '@/lib/pricingDisplay';

export const MODULE_GROUP_META = {
  platform: {
    title: 'Platform Features',
    description:
      'Web admin modules inside your account — core billing and commerce, optional inventory and CRM, plus planned builders and CMS.',
  },
  apps: {
    title: 'Mobile & Desktop Apps',
    description:
      'Native apps for owners, cashiers, and customers — Android admin dashboard, Windows POS, and branded storefront apps.',
  },
  ai: {
    title: 'AI & Growth Tools',
    description:
      'Built inside your account — content, campaigns, proposals, and insights without extra apps.',
  },
} as const;

export const MODULE_FEATURE_ITEMS: Record<string, string[]> = {
  invoicing: [
    'One-click invoices from orders',
    'PDF, WhatsApp, and email delivery',
    'Payment status tracking',
    'Dual-currency USD/LBP',
    'Supplier invoices and account statements',
  ],
  marketplace: [
    'Dedicated storefront and catalog',
    'Custom domain support',
    'Order tracking and reviews',
    'Announcements and promotions',
    'Marketplace-to-inventory sync',
  ],
  analytics: [
    'Revenue by product, staff, and period',
    'Inventory turnover reports',
    'Expense and margin analysis',
    'Audit logs and bank reconciliation',
    'Exportable financial statements',
  ],
  payments: [
    'OMT, Stripe, and local gateways',
    'Expense tracking by category',
    'Supplier credit management',
    'Cash collection and P&L visibility',
    'Custom USD/local exchange rates',
  ],
  delivery: [
    'Delivery status workflow',
    'GPS capture and staff assignment',
    'Push notifications',
    'Guest order tracking',
    'Delivery zone management',
  ],
  stock: [
    'Real-time stock levels',
    'Expiry and low-stock alerts',
    'Purchase orders and suppliers',
    'FIFO/LIFO costing',
    'Multi-location visibility',
  ],
  factory: [
    'Bill of Materials (BOM)',
    'Production runs and batch tracking',
    'Raw-to-finished goods flow',
    'Finished goods inventory',
    'Manufacturing cost visibility',
  ],
  restaurant: [
    'Live recipe deduction on sale',
    'Ingredient consumption at checkout',
    'No separate manufacturing phase',
    'Built for cafes and cloud kitchens',
  ],
  crm: [
    'Pipeline kanban and deal stages',
    'Visit and call logging with GPS',
    'Rep performance and activity feed',
    'Map view and mobile rep portal',
    'Billed add-on on paid plans',
  ],
  team: [
    'Staff roles and RBAC',
    'Sub-account permissions',
    'Customer profiles and order history',
    'Multi-user access on Business tier',
  ],
  dropship: [
    'Shein product URL linking',
    'Supplier stock sync',
    'Manual sync with status chips',
    'Supplier fields on products',
  ],
  services: [
    'Monthly and yearly service items',
    'Renewal cycles and reminders',
    'Composed service bundles',
  ],
  projects: [
    'Client project spaces',
    'Monthly/yearly contracts',
    'AI proposal generation',
    'Client portal reporting',
  ],
  builder: [
    'Drag-and-drop page editor',
    'Templates and white-label pages',
    'Standalone or add-on access',
  ],
  ai_builder: [
    'AI-assisted site generation',
    'Content blocks and layouts',
    'Integrates with AI settings API',
  ],
  blog_publisher: [
    'Tenant blog posts and categories',
    'SEO-friendly public routes',
    'Per-store CMS publishing',
  ],
  domainPackage: [
    'Custom domain connection',
    'Hosting and premium themes',
    'Available on Starter and above',
  ],
  whatsappBusiness: [
    'WhatsApp Business integration',
    'Customer notifications',
    'Available on all paid plans',
  ],
  extraStorage: [
    'Additional 5 GB storage block',
    'Stackable on Starter and above',
  ],
  admin_mobile: [
    'Android owner dashboard on Google Play',
    'Orders, products, inventory, purchases',
    'Sales CRM for reps and push alerts',
    'Same account as web admin',
  ],
  pos: [
    'Windows and mobile point of sale',
    'Barcode scanning and offline mode',
    'Multi-payment and digital receipts',
    'Dual-currency display',
  ],
  invoice_manager: [
    'Standalone mobile billing workflows',
    'Decoupled from full admin dashboard',
  ],
  whitelabel: [
    'Per-tenant customer commerce app',
    'Branded storefront for buyers',
  ],
  ai_agent: [
    'Floating in-dashboard assistant',
    'Store Q&A and daily task guidance',
    'Prepaid AI credits',
  ],
  content_creator: [
    'Product descriptions and announcements',
    'Social captions and blog drafts',
  ],
  market_strategy: [
    'Pricing and positioning suggestions',
    'Growth playbooks from store data',
  ],
  email_marketing: [
    'Campaign drafts and subject lines',
    'Subscriber lists by plan tier',
  ],
  proposal_writer: [
    'Client proposals and SOW drafts',
    'PDF-ready agency output',
  ],
  seo_assistant: [
    'Meta titles and descriptions',
    'FAQ schema suggestions',
  ],
  analytics_insights: [
    'Plain-language sales recommendations',
    'Restock and promotion suggestions',
  ],
  campaign_writer: [
    'Promotions and announcement copy',
    'Store campaign drafts',
  ],
};

export const PLATFORM_CAPABILITIES = [
  { icon: '🗂️', title: 'One Account', desc: 'All your data in one place' },
  { icon: '📱', title: 'Admin Android App', desc: 'Owner dashboard on Google Play' },
  { icon: '🔒', title: 'Secure by Default', desc: 'Firebase Auth and audit logs' },
  { icon: '⚡', title: 'Real-Time Sync', desc: 'Web and mobile stay in sync' },
  { icon: '🌍', title: 'Dual Currency', desc: 'USD plus local (LBP) rates' },
  { icon: '🔔', title: 'Push Alerts', desc: 'Orders, expiry, low stock' },
  { icon: '🤖', title: 'AI Growth Tools', desc: 'In-account content and campaigns' },
  { icon: '🏷️', title: 'White-Label', desc: 'Custom domains and templates' },
];

export function getModulesByGroup(group: PricingModule['group']): PricingModule[] {
  return MODULE_CATALOG.filter((m) => m.group === group);
}

export function getStatusBadgeClass(status: PricingModule['status']): string {
  if (status === 'live') return 'bg-teal-100 text-teal-700';
  if (status === 'beta') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 text-gray-600';
}

export function getStatusLabel(status: PricingModule['status']): string {
  if (status === 'planned') return 'In development';
  return status === 'live' ? 'Live' : 'Beta';
}

export function getBillingLabel(mod: PricingModule, tier: PaidTier = 'starter'): string {
  if (mod.billing === 'core') return 'Always included';
  if (mod.billing === 'included') return 'Included with account';
  if (mod.billing === 'planned') {
    return mod.status === 'planned' ? 'In development' : 'Optional';
  }
  return getModulePriceLabel(mod, 'monthly', tier);
}
