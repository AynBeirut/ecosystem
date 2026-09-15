import { isRoadmapModule, MODULE_CATALOG, PricingModule } from '@/lib/pricingDisplay';

/** Deferred GTM only — everything else live/beta shows on /pricing. */
const HIDDEN_PUBLIC_PRICING_IDS = new Set(['factory', 'dropship', 'projects']);

/** Venue-first, then apps & AI (full live catalog). */
const PUBLIC_PRICING_ORDER: string[] = [
  'restaurant',
  'crm',
  'pos',
  'invoicing',
  'delivery',
  'stock',
  'payments',
  'analytics',
  'marketplace',
  'whatsappBusiness',
  'domainPackage',
  'extraStorage',
  'team',
  'services',
  'builder',
  'ai_builder',
  'blog_publisher',
  'admin_mobile',
  'invoice_manager',
  'whitelabel',
  'ai_agent',
  'content_creator',
  'campaign_writer',
  'market_strategy',
  'email_marketing',
  'proposal_writer',
  'seo_assistant',
  'analytics_insights',
];

const VENUE_COPY: Partial<Record<string, Pick<PricingModule, 'name' | 'summary'>>> = {
  restaurant: {
    name: 'Live Kitchen & recipes',
    summary: 'Kitchen flow, recipes, and ingredient visibility tied to POS sales.',
  },
  crm: {
    name: 'Guest CRM',
    summary: 'Guest history, hosts, and follow-ups — connected to floor service.',
  },
  marketplace: {
    name: 'Online ordering',
    summary: 'Menu, catalog, and orders for pickup or delivery.',
  },
  delivery: {
    name: 'Delivery & drivers',
    summary: 'Dispatch, GPS, and guest order tracking.',
  },
  stock: {
    name: 'Inventory & food cost',
    summary: 'Stock, suppliers, and costing when you turn on depth.',
  },
  pos: {
    name: 'Grabio POS',
    summary: 'Windows and mobile POS — dual currency, receipts, and floor service.',
  },
  admin_mobile: {
    name: 'Grabio Admin (Android)',
    summary: 'Owner dashboard on Google Play — live during service.',
  },
  invoice_manager: {
    name: 'Invoice Manager (mobile)',
    summary: 'Mobile invoicing and billing without opening the full web admin.',
  },
  ai_agent: {
    name: 'AI Workflow Agent',
    summary: 'In-account AI agents for ops, content, and campaigns (pay-as-you-go).',
  },
};

function applyVenueCopy(mod: PricingModule): PricingModule {
  const patch = VENUE_COPY[mod.id];
  return patch ? { ...mod, ...patch } : mod;
}

export function getPublicPricingModules(): PricingModule[] {
  const byId = new Map(MODULE_CATALOG.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const ordered: PricingModule[] = [];

  for (const id of PUBLIC_PRICING_ORDER) {
    const mod = byId.get(id);
    if (!mod || HIDDEN_PUBLIC_PRICING_IDS.has(id) || isRoadmapModule(mod)) continue;
    ordered.push(applyVenueCopy(mod));
    seen.add(id);
  }

  for (const mod of MODULE_CATALOG) {
    if (seen.has(mod.id)) continue;
    if (HIDDEN_PUBLIC_PRICING_IDS.has(mod.id) || isRoadmapModule(mod)) continue;
    ordered.push(applyVenueCopy(mod));
  }

  return ordered;
}

export function getPublicPricingModulesByGroup(): Record<PricingModule['group'], PricingModule[]> {
  const groups: Record<PricingModule['group'], PricingModule[]> = {
    platform: [],
    apps: [],
    ai: [],
  };
  getPublicPricingModules().forEach((mod) => groups[mod.group].push(mod));
  return groups;
}

export const PUBLIC_PRICING_INDUSTRY_PRESETS = ['pkg_live_kitchen', 'pkg_shop', 'pkg_factory_flow'] as const;

/** Homepage strip — apps & AI guests care about after venue row. */
export const HOME_PLATFORM_EXTRAS = [
  {
    moduleId: 'admin_mobile',
    title: 'Admin Android app',
    desc: 'Owner view on Google Play while the room is live.',
    href: '/pricing',
  },
  {
    moduleId: 'invoice_manager',
    title: 'Invoice Manager app',
    desc: 'Mobile billing and invoices on the go.',
    href: '/features/invoicing/app',
  },
  {
    moduleId: 'ai_agent',
    title: 'AI Workflow Agent',
    desc: 'Multi-agent AI inside your account for content and ops.',
    href: '/pricing',
  },
  {
    moduleId: 'pos',
    title: 'Grabio POS',
    desc: 'Windows & mobile POS with dual currency.',
    href: '/features/pos/app',
  },
  {
    moduleId: 'whitelabel',
    title: 'White-label guest app',
    desc: 'Branded ordering app for your guests.',
    href: '/features/marketplace/app',
  },
  {
    moduleId: 'content_creator',
    title: 'AI content tools',
    desc: 'Menu copy, promos, and campaign drafts.',
    href: '/pricing',
  },
] as const;
