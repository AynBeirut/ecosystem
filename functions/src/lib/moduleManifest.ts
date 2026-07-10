/** Server mirror of web module manifest — keep in sync with src/lib/moduleManifest.ts */

export type BusinessWorkflow =
  | 'shop'
  | 'live_kitchen'
  | 'factory'
  | 'ngo'
  | 'freelancer'
  | 'custom';

export type StartingPackageKey =
  | 'pkg_invoice'
  | 'pkg_mini_shop'
  | 'pkg_business_backend'
  | 'pkg_shop'
  | 'pkg_live_kitchen'
  | 'pkg_factory_flow'
  | 'pkg_ngo'
  | 'pkg_freelancer';

export type PricingVersion = 'legacy-v1' | 'modular-v2';
export type ComposedProductSource = 'platform' | 'pos';

export const CORE_MODULE_IDS = [
  'invoicing',
  'marketplace',
  'analytics',
  'payments',
  'delivery',
] as const;

export const PACKAGE_PRESETS: Record<
  StartingPackageKey,
  {
    label: string;
    workflow: BusinessWorkflow;
    defaultModules: string[];
    monthlyUsd: number;
    yearlyUsd: number;
  }
> = {
  pkg_invoice: {
    label: 'Invoice Manager',
    workflow: 'freelancer',
    defaultModules: ['invoicing', 'invoice_manager', 'admin_mobile'],
    monthlyUsd: 5,
    yearlyUsd: 50,
  },
  pkg_mini_shop: {
    label: 'Mini Shop',
    workflow: 'shop',
    defaultModules: ['invoicing', 'marketplace', 'payments', 'stock', 'admin_mobile'],
    monthlyUsd: 10,
    yearlyUsd: 100,
  },
  pkg_business_backend: {
    label: 'Business Backend',
    workflow: 'shop',
    defaultModules: ['invoicing', 'analytics', 'payments', 'delivery', 'stock', 'admin_mobile'],
    monthlyUsd: 19,
    yearlyUsd: 190,
  },
  pkg_shop: {
    label: 'Shop',
    workflow: 'shop',
    defaultModules: [...CORE_MODULE_IDS, 'stock'],
    monthlyUsd: 27,
    yearlyUsd: 270,
  },
  pkg_live_kitchen: {
    label: 'Live Kitchen',
    workflow: 'live_kitchen',
    defaultModules: [...CORE_MODULE_IDS, 'stock', 'restaurant', 'pos'],
    monthlyUsd: 27,
    yearlyUsd: 270,
  },
  pkg_factory_flow: {
    label: 'Factory Flow',
    workflow: 'factory',
    defaultModules: [...CORE_MODULE_IDS, 'stock', 'factory'],
    monthlyUsd: 27,
    yearlyUsd: 270,
  },
  pkg_ngo: {
    label: 'NGO',
    workflow: 'ngo',
    defaultModules: ['invoicing', 'invoice_manager'],
    monthlyUsd: 22,
    yearlyUsd: 220,
  },
  pkg_freelancer: {
    label: 'Freelancer',
    workflow: 'freelancer',
    defaultModules: ['invoicing', 'invoice_manager'],
    monthlyUsd: 22,
    yearlyUsd: 220,
  },
};

export const MODULAR_SEAT_PRICING = {
  extraUserMonthlyUsd: 24,
  extraUserYearlyUsd: 240,
  extraPosLocationMonthlyUsd: 15,
  extraPosLocationYearlyUsd: 150,
} as const;

export function modulesRecordFromList(ids: string[]): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  const allIds = new Set([
    ...CORE_MODULE_IDS,
    'stock',
    'factory',
    'restaurant',
    'crm',
    'team',
    'dropship',
    'services',
    'pos',
    'invoice_manager',
    'projects',
    'builder',
    'ai_builder',
    'blog_publisher',
    'whitelabel',
    'admin_mobile',
    'ai_agent',
    'content_creator',
    'market_strategy',
    'email_marketing',
    'proposal_writer',
    'seo_assistant',
    'analytics_insights',
    'campaign_writer',
  ]);
  allIds.forEach((id) => {
    record[id] = ids.includes(id);
  });
  return record;
}

export function presetToEnabledModules(preset: StartingPackageKey): Record<string, boolean> {
  return modulesRecordFromList(PACKAGE_PRESETS[preset].defaultModules);
}
