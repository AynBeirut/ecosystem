import {
  CORE_MODULE_IDS,
  type BusinessWorkflow,
  type ComposedProductSource,
  type PricingVersion,
  type StartingPackageKey,
} from './moduleManifest';

type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'business';

export type StoreProfileLike = {
  subscriptionTier?: string;
  pricingVersion?: string;
  businessWorkflow?: string;
  startingPackage?: string;
  enabledModules?: Record<string, boolean>;
  seatCount?: number;
  posLocationCount?: number;
  composedProductSource?: string;
  productLimit?: number;
  storageLimitMb?: number;
  storage_limit_mb?: number;
  monthlyOperationsLimit?: number | null;
  monthly_operations_limit?: number | null;
  allowsComposedProducts?: boolean;
  allowsManufacturing?: boolean;
  addOns?: string[] | Record<string, unknown>;
  addOnsMeta?: Record<string, unknown>;
};

export type EntitlementLimits = {
  productLimit: number | null;
  storageLimitMb: number | null;
  monthlyOperationsLimit: number | null;
  allowsComposed: boolean;
  allowsManufacturing: boolean;
};

export type StoreEntitlements = {
  source: 'legacy' | 'modular';
  pricingVersion: PricingVersion;
  tier: SubscriptionTier;
  modules: Record<string, boolean>;
  businessWorkflow: BusinessWorkflow;
  startingPackage: StartingPackageKey | null;
  seatCount: number;
  posLocationCount: number;
  composedProductSource: ComposedProductSource;
  limits: EntitlementLimits;
};

const ECOSYSTEM_MODULAR = process.env.ECOSYSTEM_MODULAR === 'true';

const LEGACY_LIMITS: Record<SubscriptionTier, EntitlementLimits> = {
  trial: {
    productLimit: 10,
    storageLimitMb: 500,
    monthlyOperationsLimit: 30,
    allowsComposed: false,
    allowsManufacturing: false,
  },
  starter: {
    productLimit: 8,
    storageLimitMb: 5120,
    monthlyOperationsLimit: null,
    allowsComposed: true,
    allowsManufacturing: false,
  },
  pro: {
    productLimit: 20,
    storageLimitMb: 10240,
    monthlyOperationsLimit: null,
    allowsComposed: true,
    allowsManufacturing: true,
  },
  business: {
    productLimit: 50,
    storageLimitMb: 20480,
    monthlyOperationsLimit: null,
    allowsComposed: true,
    allowsManufacturing: true,
  },
};

function normalizeTier(raw?: string): SubscriptionTier {
  if (raw === 'trial' || raw === 'starter' || raw === 'pro' || raw === 'business') return raw;
  if (raw === 'premium') return 'starter';
  return 'starter';
}

function hasAddon(profile: StoreProfileLike, key: string): boolean {
  const addOns = profile.addOns;
  if (Array.isArray(addOns) && addOns.includes(key)) return true;
  if (profile.addOnsMeta?.[key] === true) return true;
  if (addOns && typeof addOns === 'object' && !Array.isArray(addOns)) {
    return (addOns as Record<string, unknown>)[key] === true;
  }
  return false;
}

function workflowFromProfile(profile: StoreProfileLike): BusinessWorkflow {
  const raw = profile.businessWorkflow;
  if (
    raw === 'shop' ||
    raw === 'live_kitchen' ||
    raw === 'factory' ||
    raw === 'ngo' ||
    raw === 'freelancer' ||
    raw === 'custom'
  ) {
    return raw;
  }
  if (profile.allowsManufacturing) return 'factory';
  return 'shop';
}

function legacyModulesForTier(tier: SubscriptionTier, profile: StoreProfileLike): Record<string, boolean> {
  const modules: Record<string, boolean> = {};
  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = true;
  });
  modules.stock = true;
  modules.dropship = true;
  modules.services = true;
  modules.admin_mobile = true;
  if (tier === 'pro' || tier === 'business') {
    modules.factory = true;
    modules.restaurant = true;
  }
  if (hasAddon(profile, 'salesCrm')) modules.crm = true;
  if (tier === 'business') modules.team = true;
  return modules;
}

function modularModulesFromProfile(profile: StoreProfileLike): Record<string, boolean> {
  const enabled = profile.enabledModules ?? {};
  const modules: Record<string, boolean> = {};
  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = enabled[id] !== false;
  });
  Object.entries(enabled).forEach(([id, on]) => {
    modules[id] = Boolean(on);
  });
  return modules;
}

function limitsFromProfile(tier: SubscriptionTier, profile: StoreProfileLike): EntitlementLimits {
  const base = LEGACY_LIMITS[tier];
  return {
    productLimit: profile.productLimit ?? base.productLimit,
    storageLimitMb: profile.storageLimitMb ?? profile.storage_limit_mb ?? base.storageLimitMb,
    monthlyOperationsLimit:
      profile.monthlyOperationsLimit ??
      profile.monthly_operations_limit ??
      base.monthlyOperationsLimit,
    allowsComposed: profile.allowsComposedProducts ?? base.allowsComposed,
    allowsManufacturing: profile.allowsManufacturing ?? base.allowsManufacturing,
  };
}

export function resolveStoreEntitlements(profile: StoreProfileLike | null | undefined): StoreEntitlements | null {
  if (!profile) return null;

  const tier = normalizeTier(profile.subscriptionTier);
  const pricingVersion: PricingVersion =
    profile.pricingVersion === 'modular-v2' ? 'modular-v2' : 'legacy-v1';

  const useModular =
    ECOSYSTEM_MODULAR &&
    pricingVersion === 'modular-v2' &&
    profile.enabledModules &&
    Object.keys(profile.enabledModules).length > 0;

  const modules = useModular ? modularModulesFromProfile(profile) : legacyModulesForTier(tier, profile);

  const startingPackage = profile.startingPackage as StartingPackageKey | undefined;

  return {
    source: useModular ? 'modular' : 'legacy',
    pricingVersion,
    tier,
    modules,
    businessWorkflow: workflowFromProfile(profile),
    startingPackage: startingPackage ?? null,
    seatCount: Math.max(1, Number(profile.seatCount) || 1),
    posLocationCount: Math.max(0, Number(profile.posLocationCount) || 0),
    composedProductSource: profile.composedProductSource === 'pos' ? 'pos' : 'platform',
    limits: limitsFromProfile(tier, profile),
  };
}

export function canUseModule(profile: StoreProfileLike | null | undefined, moduleId: string): boolean {
  const entitlements = resolveStoreEntitlements(profile);
  if (!entitlements) return false;
  return Boolean(entitlements.modules[moduleId]);
}
