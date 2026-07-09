export type BillingCycle = 'monthly' | 'yearly';
export type PaidTier = 'starter' | 'pro' | 'business';
export type SubscriptionTier = 'trial' | PaidTier;

export type AddOnKey = 'domainPackage' | 'whatsappBusiness' | 'salesCrm' | 'extraStorage';

export type AddOnSelection = {
  domainPackage: boolean;
  whatsappBusiness: boolean;
  salesCrm: boolean;
  extraStorageBlocks: number;
};

export type ModuleBillingKind =
  | 'core'
  | 'tier'
  | 'addon'
  | 'included'
  | 'planned';

export type PricingModule = {
  id: string;
  name: string;
  group: 'platform' | 'apps' | 'ai';
  icon: string;
  summary: string;
  billing: ModuleBillingKind;
  /** Paid add-on key when billing === 'addon' */
  addOnKey?: AddOnKey;
  /** Minimum paid tier when billing === 'tier' */
  minTier?: PaidTier;
  status: 'live' | 'beta' | 'planned' | 'coming_soon';
};

/** Shown on /features — hidden from checkout toggles */
export function isRoadmapModule(mod: PricingModule): boolean {
  return mod.status === 'planned' || mod.status === 'coming_soon';
}

export const PLAN_PRICING: Record<PaidTier, { monthly: number; yearly: number }> = {
  starter: { monthly: 10, yearly: 100 },
  pro: { monthly: 20, yearly: 200 },
  business: { monthly: 30, yearly: 300 },
};

export const ADDON_PRICING: Record<AddOnKey, { monthly: number; yearly: number; label: string }> = {
  domainPackage: { monthly: 10, yearly: 100, label: 'Custom Domain Package' },
  whatsappBusiness: { monthly: 8, yearly: 80, label: 'WhatsApp Business' },
  salesCrm: { monthly: 8, yearly: 80, label: 'Sales CRM' },
  extraStorage: { monthly: 2, yearly: 20, label: 'Extra Storage (5 GB)' },
};

export const PLAN_ELIGIBLE_ADDONS: Record<SubscriptionTier, AddOnKey[]> = {
  trial: ['whatsappBusiness'],
  starter: ['domainPackage', 'whatsappBusiness', 'salesCrm', 'extraStorage'],
  pro: ['domainPackage', 'whatsappBusiness', 'salesCrm', 'extraStorage'],
  business: ['domainPackage', 'whatsappBusiness', 'salesCrm', 'extraStorage'],
};

export const TIER_ORDER: PaidTier[] = ['starter', 'pro', 'business'];

export const MODULE_CATALOG: PricingModule[] = [
  { id: 'invoicing', name: 'Invoicing & Billing', group: 'platform', icon: '📄', summary: 'Invoices, PDF/WhatsApp delivery, dual currency', billing: 'core', status: 'live' },
  { id: 'marketplace', name: 'Online Marketplace', group: 'platform', icon: '🏪', summary: 'Storefront, catalog, orders, custom domain ready', billing: 'core', status: 'live' },
  { id: 'analytics', name: 'Analytics & Reports', group: 'platform', icon: '📊', summary: 'Revenue, inventory turnover, statements', billing: 'core', status: 'live' },
  { id: 'payments', name: 'Payments & Finance', group: 'platform', icon: '💳', summary: 'OMT, Stripe, expenses, P&L', billing: 'core', status: 'live' },
  { id: 'delivery', name: 'Delivery & Fulfillment', group: 'platform', icon: '🚚', summary: 'Delivery workflow, GPS, push alerts', billing: 'core', status: 'live' },
  { id: 'stock', name: 'Inventory & Stock', group: 'platform', icon: '📦', summary: 'Real-time stock, expiry alerts, suppliers', billing: 'planned', status: 'live' },
  { id: 'factory', name: 'Factory & Production', group: 'platform', icon: '🏭', summary: 'BOM, production runs, batch manufacturing', billing: 'tier', minTier: 'pro', status: 'live' },
  { id: 'restaurant', name: 'Restaurant Production', group: 'platform', icon: '🍽️', summary: 'Live recipe deduction on sale', billing: 'planned', status: 'beta' },
  { id: 'crm', name: 'Sales CRM', group: 'platform', icon: '🎯', summary: 'Pipeline, field reps, visit logging', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'domainPackage', name: 'Custom Domain Package', group: 'platform', icon: '🌐', summary: 'Your domain, hosting, premium themes', billing: 'addon', addOnKey: 'domainPackage', status: 'live' },
  { id: 'whatsappBusiness', name: 'WhatsApp Business', group: 'platform', icon: '💬', summary: 'WhatsApp notifications and messaging', billing: 'addon', addOnKey: 'whatsappBusiness', status: 'live' },
  { id: 'extraStorage', name: 'Extra Storage (5 GB)', group: 'platform', icon: '💾', summary: 'Additional storage block', billing: 'addon', addOnKey: 'extraStorage', status: 'live' },
  { id: 'team', name: 'Team & Sub-Accounts', group: 'platform', icon: '👥', summary: 'Staff roles and permissions', billing: 'tier', minTier: 'business', status: 'live' },
  { id: 'dropship', name: 'Dropship Sync', group: 'platform', icon: '🔗', summary: 'Shein supplier links and stock sync', billing: 'planned', status: 'live' },
  { id: 'services', name: 'Service Subscriptions', group: 'platform', icon: '🔄', summary: 'Monthly/yearly service billing cycles', billing: 'planned', status: 'beta' },
  { id: 'projects', name: 'Projects (PSA)', group: 'platform', icon: '💼', summary: 'Agency projects and client portals', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'builder', name: 'Web Builder', group: 'platform', icon: '🎨', summary: 'Store templates, branding, colors — powered by AI', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'ai_builder', name: 'AI Builder', group: 'platform', icon: '✨', summary: 'AI site and content generation', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'blog_publisher', name: 'Blog Publisher', group: 'platform', icon: '📰', summary: 'Write and publish articles on your store page', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'timesheet_attendance', name: 'Timesheet & Attendance', group: 'platform', icon: '⏱️', summary: 'PIN, badge, or face-scan clock-in linked to payroll', billing: 'planned', status: 'planned' },
  { id: 'recruitment_ats', name: 'Recruitment Funnel (ATS)', group: 'platform', icon: '📋', summary: 'Job postings, resumes, interview stages, and hiring pipeline', billing: 'planned', status: 'planned' },
  { id: 'expense_ocr', name: 'Expense OCR Scanning', group: 'platform', icon: '🧾', summary: 'Receipt photos with AI extraction for reimbursement requests', billing: 'planned', status: 'planned' },
  { id: 'shopify_importer', name: 'Shopify Importer & Clone', group: 'platform', icon: '🛍️', summary: '1-click migration from Shopify API or CSV — products, customers, orders', billing: 'planned', status: 'coming_soon' },
  { id: 'localized_logistics', name: 'Localized Logistics', group: 'platform', icon: '🚛', summary: 'Aramex, MotoBoy, and regional fleets — labels and WhatsApp tracking', billing: 'planned', status: 'coming_soon' },
  { id: 'whatsapp_marketing_engine', name: 'WhatsApp Marketing Engine', group: 'platform', icon: '📲', summary: 'Abandoned cart recovery, VIP restock alerts, and triggered promos', billing: 'planned', status: 'coming_soon' },
  { id: 'dual_currency_accounting', name: 'Dual-Currency Accounting Shield', group: 'platform', icon: '💱', summary: 'USD-pegged prices with real-time parallel-market checkout conversion', billing: 'planned', status: 'coming_soon' },
  { id: 'legal_esign', name: 'Legal Docs & E-Signatures', group: 'platform', icon: '✍️', summary: 'Contracts, NDAs, and quotes with native digital signature', billing: 'planned', status: 'planned' },
  { id: 'plm_eco', name: 'Product Lifecycle (PLM)', group: 'platform', icon: '🔬', summary: 'Engineering change orders and blueprint version control', billing: 'planned', status: 'planned' },
  { id: 'admin_mobile', name: 'Grabio Admin App', group: 'apps', icon: '📱', summary: 'Android owner dashboard on Google Play', billing: 'included', status: 'live' },
  { id: 'pos', name: 'Grabio POS', group: 'apps', icon: '🖥️', summary: 'Windows POS — download, install, sync with your store', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'invoice_manager', name: 'Invoice Manager App', group: 'apps', icon: '📱', summary: 'Standalone mobile billing app', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'whitelabel', name: 'White-Label Store App', group: 'apps', icon: '📲', summary: 'Branded customer commerce app', billing: 'tier', minTier: 'business', status: 'live' },
  { id: 'ai_agent', name: 'AI Workflow Agent', group: 'ai', icon: '🤖', summary: 'In-dashboard AI assistant', billing: 'planned', status: 'beta' },
  { id: 'content_creator', name: 'Content Creator', group: 'ai', icon: '✍️', summary: 'Product copy, social, blog drafts', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'market_strategy', name: 'Market Strategy', group: 'ai', icon: '📈', summary: 'Growth and positioning insights', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'email_marketing', name: 'Email Marketing', group: 'ai', icon: '📧', summary: 'Campaigns — limits vary by plan tier', billing: 'tier', minTier: 'starter', status: 'beta' },
  { id: 'proposal_writer', name: 'Proposal Writer', group: 'ai', icon: '📝', summary: 'Client proposals and SOW drafts', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'seo_assistant', name: 'SEO Assistant', group: 'ai', icon: '🔍', summary: 'Meta titles, FAQ schema suggestions', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'analytics_insights', name: 'Business Insights', group: 'ai', icon: '💡', summary: 'Plain-language analytics recommendations', billing: 'tier', minTier: 'starter', status: 'live' },
  { id: 'campaign_writer', name: 'Campaign & Promo Writer', group: 'ai', icon: '📣', summary: 'Promotions and announcement copy', billing: 'tier', minTier: 'starter', status: 'live' },
];

export const EMPTY_ADDON_SELECTION: AddOnSelection = {
  domainPackage: false,
  whatsappBusiness: false,
  salesCrm: false,
  extraStorageBlocks: 0,
};

export function normalizeTier(tier?: string | null): SubscriptionTier {
  if (!tier) return 'starter';
  if (tier === 'premium') return 'starter';
  if (tier === 'trial' || tier === 'starter' || tier === 'pro' || tier === 'business') return tier;
  return 'starter';
}

export function tierMeetsMinimum(selected: PaidTier, minTier: PaidTier): boolean {
  return TIER_ORDER.indexOf(selected) >= TIER_ORDER.indexOf(minTier);
}

export function normalizeAddOnsFromProfile(addOns: unknown): AddOnSelection {
  if (Array.isArray(addOns)) {
    return {
      domainPackage: addOns.includes('domainPackage') || addOns.includes('customDomainHosting'),
      whatsappBusiness: addOns.includes('whatsappBusiness'),
      salesCrm: addOns.includes('salesCrm'),
      extraStorageBlocks: addOns.includes('extraStorage') || addOns.includes('storage') ? 1 : 0,
    };
  }
  const value = (addOns && typeof addOns === 'object' ? addOns : {}) as Record<string, unknown>;
  return {
    domainPackage: Boolean(value.domainPackage),
    whatsappBusiness: Boolean(value.whatsappBusiness),
    salesCrm: Boolean(value.salesCrm),
    extraStorageBlocks: Math.max(0, Number(value.extraStorageBlocks) || 0),
  };
}

export function selectionFromModules(
  modules: Record<string, boolean>,
  tier: PaidTier,
): AddOnSelection {
  const selection = { ...EMPTY_ADDON_SELECTION };
  MODULE_CATALOG.forEach((mod) => {
    if (!modules[mod.id]) return;
    if (mod.billing === 'addon' && mod.addOnKey) {
      if (mod.addOnKey === 'extraStorage') {
        selection.extraStorageBlocks = Math.max(selection.extraStorageBlocks, 1);
      } else {
        selection[mod.addOnKey] = true;
      }
    }
  });
  if (modules.extraStorage) {
    selection.extraStorageBlocks = Math.max(selection.extraStorageBlocks, 1);
  }
  if (modules.domainPackage) selection.domainPackage = true;
  if (modules.whatsappBusiness) selection.whatsappBusiness = true;
  return selection;
}

export function modulesFromSelection(
  tier: PaidTier,
  addOns: AddOnSelection,
): Record<string, boolean> {
  const modules: Record<string, boolean> = {};
  MODULE_CATALOG.forEach((mod) => {
    if (mod.billing === 'core' || mod.billing === 'included') {
      modules[mod.id] = true;
      return;
    }
    if (mod.billing === 'tier' && mod.minTier && tierMeetsMinimum(tier, mod.minTier)) {
      modules[mod.id] = true;
      return;
    }
    if (mod.billing === 'addon' && mod.addOnKey) {
      if (mod.addOnKey === 'extraStorage') {
        modules[mod.id] = addOns.extraStorageBlocks > 0;
      } else {
        modules[mod.id] = addOns[mod.addOnKey];
      }
    }
  });
  return modules;
}

export type PackageLineItem = {
  label: string;
  amount: number | null;
  note?: string;
};

export function calculatePackageTotal(
  tier: PaidTier,
  billing: BillingCycle,
  addOns: AddOnSelection,
): { lineItems: PackageLineItem[]; total: number; periodLabel: string } {
  const lineItems: PackageLineItem[] = [
    {
      label: `${tier.charAt(0).toUpperCase()}${tier.slice(1)} plan`,
      amount: PLAN_PRICING[tier][billing],
    },
  ];

  let total = PLAN_PRICING[tier][billing];
  const eligible = new Set(PLAN_ELIGIBLE_ADDONS[tier]);

  (Object.keys(ADDON_PRICING) as AddOnKey[]).forEach((key) => {
    if (!eligible.has(key)) return;
    if (key === 'extraStorage') {
      if (addOns.extraStorageBlocks > 0) {
        const amount = addOns.extraStorageBlocks * ADDON_PRICING.extraStorage[billing];
        lineItems.push({
          label: `${ADDON_PRICING.extraStorage.label} × ${addOns.extraStorageBlocks}`,
          amount,
        });
        total += amount;
      }
      return;
    }
    if (addOns[key]) {
      const amount = ADDON_PRICING[key][billing];
      lineItems.push({ label: ADDON_PRICING[key].label, amount });
      total += amount;
    }
  });

  return {
    lineItems,
    total,
    periodLabel: billing === 'yearly' ? '/year' : '/month',
  };
}

export function getModulePriceLabel(
  mod: PricingModule,
  billing: BillingCycle,
  tier: PaidTier,
): string {
  if (mod.billing === 'core' || mod.billing === 'included') return 'Included';
  if (mod.billing === 'tier' && mod.minTier) {
    return tierMeetsMinimum(tier, mod.minTier)
      ? `Included on ${mod.minTier === 'business' ? 'Business' : 'Pro'}+`
      : `Requires ${mod.minTier === 'business' ? 'Business' : 'Pro'}+ plan`;
  }
  if (mod.billing === 'addon' && mod.addOnKey) {
    const price = ADDON_PRICING[mod.addOnKey][billing];
    return `+$${price}/${billing === 'yearly' ? 'yr' : 'mo'}`;
  }
  if (mod.billing === 'planned') {
    if (mod.status === 'coming_soon') return 'Coming soon';
    if (mod.status === 'planned') return 'In development';
    return 'Optional — billing TBA';
  }
  return 'Optional';
}
