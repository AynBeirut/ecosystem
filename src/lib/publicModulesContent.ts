import { MODULE_CATALOG, PricingModule, getModulePriceLabel, isRoadmapModule, type PaidTier } from '@/lib/pricingDisplay';

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
  timesheet_attendance: [
    'PIN, badge, or face-scan clock-in',
    'Shift and overtime tracking',
    'Attendance linked to payroll runs',
    'Manager approval workflows',
  ],
  recruitment_ats: [
    'Job board posting templates',
    'Resume intake and pipeline stages',
    'Interview scheduling and notes',
    'Hire-to-onboarding handoff',
  ],
  expense_ocr: [
    'Mobile receipt capture',
    'AI text and tax extraction',
    'Auto-filled reimbursement forms',
    'Manager review and approval queue',
  ],
  shopify_importer: [
    'Shopify API or CSV import',
    'Products, variants, and images',
    'Customer records and order history',
    'Storefront preview before cutover',
  ],
  localized_logistics: [
    'Aramex, MotoBoy, and regional fleets',
    'One-click assign delivery',
    'Partner shipping label print',
    'Customer tracking link via WhatsApp',
  ],
  whatsapp_marketing_engine: [
    'Abandoned cart recovery (timed discount)',
    'VIP restock and low-stock alerts',
    'Order and delivery notifications',
    'Campaign triggers from store events',
  ],
  dual_currency_accounting: [
    'USD-pegged catalog prices',
    'Daily parallel-market rate updates',
    'Instant LBP calculation at checkout',
    'Accounting reports in both currencies',
  ],
  legal_esign: [
    'Secure document vault per store',
    'Contract and NDA routing',
    'Native e-signature capture',
    'Audit trail and version history',
  ],
  plm_eco: [
    'Engineering Change Orders (ECO)',
    'Blueprint and recipe version history',
    'Effective-date mapping for formula shifts',
    'Audit trail for manufacturing compliance',
  ],
};

export const PLATFORM_CAPABILITIES = [
  { title: 'One Account', desc: 'All your data in one place' },
  { title: 'Admin Android App', desc: 'Owner dashboard on Google Play' },
  { title: 'Secure by Default', desc: 'Firebase Auth and audit logs' },
  { title: 'Real-Time Sync', desc: 'Web and mobile stay in sync' },
  { title: 'Dual Currency', desc: 'USD plus local (LBP) rates' },
  { title: 'Push Alerts', desc: 'Orders, expiry, low stock' },
  { title: 'AI Growth Tools', desc: 'In-account content and campaigns' },
  { title: 'White-Label', desc: 'Custom domains and templates' },
];

export function getModulesByGroup(group: PricingModule['group']): PricingModule[] {
  const items = MODULE_CATALOG.filter((m) => m.group === group);
  return [...items].sort((a, b) => Number(isRoadmapModule(a)) - Number(isRoadmapModule(b)));
}

export function getStatusBadgeClass(status: PricingModule['status']): string {
  if (status === 'live') return 'bg-teal-100 text-teal-700';
  if (status === 'beta') return 'bg-amber-100 text-amber-800';
  if (status === 'coming_soon') return 'bg-violet-100 text-violet-800';
  if (status === 'planned') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-600';
}

export function getStatusLabel(status: PricingModule['status']): string {
  if (status === 'coming_soon') return 'Coming soon';
  if (status === 'planned') return 'In development';
  return status === 'live' ? 'Live' : 'Beta';
}

export function getBillingLabel(mod: PricingModule, tier: PaidTier = 'starter'): string {
  if (isRoadmapModule(mod)) {
    return mod.status === 'coming_soon' ? 'Coming soon' : 'In development';
  }
  if (mod.billing === 'core') return 'Always included';
  if (mod.billing === 'included') return 'Included with account';
  if (mod.billing === 'planned') {
    return 'Optional — billing TBA';
  }
  return getModulePriceLabel(mod, 'monthly', tier);
}
