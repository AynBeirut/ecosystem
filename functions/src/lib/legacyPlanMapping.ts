import {
  presetToEnabledModules,
  type StartingPackageKey,
} from './moduleManifest';

export type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'business';

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

export function mapLegacyTierToModular(profile: Record<string, unknown>) {
  const tier = normalizeTier(profile.subscriptionTier as string | undefined);
  let preset: StartingPackageKey = 'pkg_shop';

  if (tier === 'pro') {
    preset = profile.allowsManufacturing ? 'pkg_factory_flow' : 'pkg_live_kitchen';
  } else if (tier === 'business') {
    preset = 'pkg_shop';
  }

  const modules = { ...presetToEnabledModules(preset) };
  if (hasAddon(profile, 'salesCrm')) modules.crm = true;

  return {
    nextPlanPreset: preset,
    nextEnabledModules: modules,
    nextSeatCount: tier === 'business' ? Math.max(1, Number(profile.seatCount) || 3) : 1,
    nextPosLocationCount: preset === 'pkg_live_kitchen' ? 1 : 0,
    legacyPlanSnapshot: {
      subscriptionTier: tier,
      subscriptionPlan: profile.subscriptionPlan,
      addOns: profile.addOns,
      addOnsMeta: profile.addOnsMeta,
      capturedAt: new Date().toISOString(),
    },
  };
}

export function buildRenewalMigrationPatch(
  profile: Record<string, unknown>,
  scheduledAt: string,
): Record<string, unknown> {
  const plan = mapLegacyTierToModular(profile);
  return {
    ...plan,
    scheduledPlanMigrationAt: scheduledAt,
    pricingVersion: 'legacy-v1',
  };
}
