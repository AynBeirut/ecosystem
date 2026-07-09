import type { StartingPackageKey } from './moduleManifest';
import { presetToEnabledModules } from './moduleManifest';

export type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'business';

export type LegacyMigrationPlan = {
  nextPlanPreset: StartingPackageKey;
  nextEnabledModules: Record<string, boolean>;
  nextSeatCount: number;
  nextPosLocationCount: number;
  legacyPlanSnapshot: Record<string, unknown>;
  manualReview: boolean;
  notes: string[];
};

function hasAddon(data: Record<string, unknown>, key: string): boolean {
  const addOns = data.addOns;
  if (Array.isArray(addOns) && addOns.includes(key)) return true;
  const meta = data.addOnsMeta as Record<string, unknown> | undefined;
  if (meta?.[key] === true) return true;
  return false;
}

function normalizeTier(raw?: string): SubscriptionTier {
  if (raw === 'trial' || raw === 'starter' || raw === 'pro' || raw === 'business') return raw;
  if (raw === 'premium') return 'starter';
  return 'starter';
}

export function mapLegacyTierToModular(
  profile: Record<string, unknown>,
): LegacyMigrationPlan {
  const tier = normalizeTier(profile.subscriptionTier as string | undefined);
  const notes: string[] = [];
  let manualReview = false;

  const legacyPlanSnapshot = {
    subscriptionTier: tier,
    subscriptionPlan: profile.subscriptionPlan,
    addOns: profile.addOns,
    addOnsMeta: profile.addOnsMeta,
    capturedAt: new Date().toISOString(),
  };

  if (tier === 'trial') {
    return {
      nextPlanPreset: 'pkg_shop',
      nextEnabledModules: presetToEnabledModules('pkg_shop'),
      nextSeatCount: 1,
      nextPosLocationCount: 0,
      legacyPlanSnapshot,
      manualReview: true,
      notes: ['Trial accounts choose preset at conversion — no auto-migration price.'],
    };
  }

  let preset: StartingPackageKey = 'pkg_shop';
  if (tier === 'starter') {
    preset = 'pkg_shop';
  } else if (tier === 'pro') {
    if (profile.allowsManufacturing) {
      preset = 'pkg_factory_flow';
    } else if (profile.allowsComposedProducts) {
      preset = 'pkg_live_kitchen';
      notes.push('Pro with composed products mapped to Live Kitchen.');
    } else {
      preset = 'pkg_shop';
      notes.push('Pro without manufacturing — mapped to Shop + review modules.');
      manualReview = true;
    }
  } else if (tier === 'business') {
    preset = 'pkg_shop';
    notes.push('Business tier — map seats to TEAM-USER count.');
  }

  const modules = { ...presetToEnabledModules(preset) };
  if (hasAddon(profile, 'salesCrm')) modules.crm = true;

  let seatCount = 1;
  if (tier === 'business') {
    seatCount = Math.max(1, Number(profile.seatCount) || 3);
  }

  const posLocationCount = preset === 'pkg_live_kitchen' ? 1 : 0;

  return {
    nextPlanPreset: preset,
    nextEnabledModules: modules,
    nextSeatCount: seatCount,
    nextPosLocationCount: posLocationCount,
    legacyPlanSnapshot,
    manualReview,
    notes,
  };
}

export function buildRenewalMigrationPatch(
  profile: Record<string, unknown>,
  scheduledAt: string,
): Record<string, unknown> {
  const plan = mapLegacyTierToModular(profile);
  return {
    nextPlanPreset: plan.nextPlanPreset,
    nextEnabledModules: plan.nextEnabledModules,
    nextSeatCount: plan.nextSeatCount,
    nextPosLocationCount: plan.nextPosLocationCount,
    legacyPlanSnapshot: plan.legacyPlanSnapshot,
    scheduledPlanMigrationAt: scheduledAt,
    pricingVersion: 'legacy-v1',
  };
}

export function applyRenewalMigration(profile: Record<string, unknown>): Record<string, unknown> {
  const preset = (profile.nextPlanPreset as StartingPackageKey) || 'pkg_shop';
  return {
    pricingVersion: 'modular-v2',
    startingPackage: preset,
    businessWorkflow:
      preset === 'pkg_live_kitchen'
        ? 'live_kitchen'
        : preset === 'pkg_factory_flow'
          ? 'factory'
          : 'shop',
    enabledModules: profile.nextEnabledModules ?? presetToEnabledModules(preset),
    seatCount: profile.nextSeatCount ?? 1,
    posLocationCount: profile.nextPosLocationCount ?? 0,
    nextPlanPreset: null,
    nextEnabledModules: null,
    nextSeatCount: null,
    nextPosLocationCount: null,
    scheduledPlanMigrationAt: null,
  };
}
