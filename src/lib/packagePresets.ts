export {
  PACKAGE_PRESETS,
  CORE_MODULE_IDS,
  MODULAR_SEAT_PRICING,
  presetToEnabledModules,
  modulesRecordFromList,
  type StartingPackageKey,
  type BusinessWorkflow,
} from '@/lib/moduleManifest';

import {
  PACKAGE_PRESETS,
  presetToEnabledModules,
  type StartingPackageKey,
  type BusinessWorkflow,
} from '@/lib/moduleManifest';
import type { StoreProfile } from '@/types/storeProfile';
import { modularLimitsPatch, presetLimitLines } from '@/lib/modularPackageLimits';

export function buildProfileFromPreset(preset: StartingPackageKey): Partial<StoreProfile> {
  const config = PACKAGE_PRESETS[preset];
  const enabledModules = presetToEnabledModules(preset);
  const base: Partial<StoreProfile> = {
    pricingVersion: 'modular-v2',
    startingPackage: preset,
    businessWorkflow: config.workflow,
    enabledModules,
    seatCount: 1,
    posLocationCount: config.defaultModules.includes('pos') ? 1 : 0,
    composedProductSource: 'platform',
    modularMonthlyUsd: config.monthlyUsd,
  };
  const limits = modularLimitsPatch({
    ...base,
    startingPackage: preset,
    modularMonthlyUsd: config.monthlyUsd,
    enabledModules,
  } as StoreProfile);
  return {
    ...base,
    productLimit: limits.productLimit ?? undefined,
    storageLimitMb: limits.storageLimitMb,
    storage_limit_mb: limits.storageLimitMb,
  };
}

export const PRESET_LIST = Object.entries(PACKAGE_PRESETS).map(([key, value]) => ({
  key: key as StartingPackageKey,
  ...value,
  limitLines: presetLimitLines(key as StartingPackageKey),
}));

const PRESET_ORDER: StartingPackageKey[] = [
  'pkg_invoice',
  'pkg_mini_shop',
  'pkg_business_backend',
  'pkg_shop',
  'pkg_live_kitchen',
  'pkg_factory_flow',
  'pkg_ngo',
  'pkg_freelancer',
];

export const ORDERED_PRESET_LIST = PRESET_ORDER
  .map((key) => PRESET_LIST.find((p) => p.key === key))
  .filter((p): p is (typeof PRESET_LIST)[number] => Boolean(p));

export function presetLabel(workflow: BusinessWorkflow): string {
  const match = PRESET_LIST.find((p) => p.workflow === workflow);
  return match?.label ?? 'Custom';
}
