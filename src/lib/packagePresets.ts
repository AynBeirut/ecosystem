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

export function buildProfileFromPreset(preset: StartingPackageKey): Partial<StoreProfile> {
  const config = PACKAGE_PRESETS[preset];
  return {
    pricingVersion: 'modular-v2',
    startingPackage: preset,
    businessWorkflow: config.workflow,
    enabledModules: presetToEnabledModules(preset),
    seatCount: 1,
    posLocationCount: config.defaultModules.includes('pos') ? 1 : 0,
    composedProductSource: 'platform',
  };
}

export const PRESET_LIST = Object.entries(PACKAGE_PRESETS).map(([key, value]) => ({
  key: key as StartingPackageKey,
  ...value,
}));

export function presetLabel(workflow: BusinessWorkflow): string {
  const match = PRESET_LIST.find((p) => p.workflow === workflow);
  return match?.label ?? 'Custom';
}
