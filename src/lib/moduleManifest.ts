import type { PricingModule } from '@/lib/pricingDisplay';
import { MODULE_CATALOG } from '@/lib/pricingDisplay';

export type BusinessWorkflow =
  | 'shop'
  | 'live_kitchen'
  | 'factory'
  | 'ngo'
  | 'freelancer'
  | 'custom';

export type StartingPackageKey =
  | 'pkg_shop'
  | 'pkg_live_kitchen'
  | 'pkg_factory_flow'
  | 'pkg_ngo'
  | 'pkg_freelancer';

export type PricingVersion = 'legacy-v1' | 'modular-v2';
export type ComposedProductSource = 'platform' | 'pos';
export type ModuleId = PricingModule['id'];

export const CORE_MODULE_IDS: ModuleId[] = [
  'invoicing',
  'marketplace',
  'analytics',
  'payments',
  'delivery',
];

export const PACKAGE_PRESETS: Record<
  StartingPackageKey,
  {
    label: string;
    workflow: BusinessWorkflow;
    defaultModules: ModuleId[];
    monthlyUsd: number;
    yearlyUsd: number;
  }
> = {
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

export function getModuleById(id: string): PricingModule | undefined {
  return MODULE_CATALOG.find((m) => m.id === id);
}

export function modulesRecordFromList(ids: ModuleId[]): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  MODULE_CATALOG.forEach((mod) => {
    record[mod.id] = ids.includes(mod.id);
  });
  return record;
}

export function presetToEnabledModules(preset: StartingPackageKey): Record<string, boolean> {
  return modulesRecordFromList(PACKAGE_PRESETS[preset].defaultModules);
}
