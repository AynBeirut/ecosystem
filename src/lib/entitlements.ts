import {
  MODULE_CATALOG,
  modulesFromSelection,
  normalizeAddOnsFromProfile,
  normalizeTier,
  type PaidTier,
  type SubscriptionTier,
} from '@/lib/pricingDisplay';
import { isModularEntitlementsEnabled } from '@/lib/ecosystemFlags';
import {
  CORE_MODULE_IDS,
  type BusinessWorkflow,
  type ComposedProductSource,
  type PricingVersion,
  type StartingPackageKey,
} from '@/lib/moduleManifest';
import type { StoreProfile } from '@/types/storeProfile';

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

function workflowFromProfile(profile: StoreProfile): BusinessWorkflow {
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

function legacyModulesForTier(tier: SubscriptionTier, profile: StoreProfile): Record<string, boolean> {
  const paidTier: PaidTier = tier === 'trial' ? 'starter' : tier;
  const addOns = normalizeAddOnsFromProfile(profile.addOns ?? profile.addOnsMeta);
  const modules = modulesFromSelection(paidTier, addOns);

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

  // Legacy CRM is add-on gated only — ignore tier grant from modulesFromSelection().
  modules.crm = addOns.salesCrm;

  return modules;
}

function modularModulesFromProfile(profile: StoreProfile): Record<string, boolean> {
  const enabled = profile.enabledModules ?? {};
  const modules: Record<string, boolean> = {};

  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = enabled[id] !== false;
  });

  Object.entries(enabled).forEach(([id, on]) => {
    modules[id] = Boolean(on);
  });

  // Tier-included modules (builder, blog_publisher, …) still apply on modular-v2 unless explicitly disabled.
  const tier = normalizeTier(profile.subscriptionTier);
  const paidTier: PaidTier = tier === 'trial' ? 'starter' : tier;
  const tierGranted = modulesFromSelection(paidTier, normalizeAddOnsFromProfile(profile.addOns ?? profile.addOnsMeta));
  for (const mod of MODULE_CATALOG) {
    if (mod.billing !== 'tier') continue;
    if (enabled[mod.id] === false) continue;
    if (tierGranted[mod.id]) modules[mod.id] = true;
  }

  return modules;
}

function limitsFromProfile(tier: SubscriptionTier, profile: StoreProfile): EntitlementLimits {
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

export function resolveStoreEntitlements(profile: StoreProfile | null | undefined): StoreEntitlements | null {
  if (!profile) return null;

  const tier = normalizeTier(profile.subscriptionTier);
  const pricingVersion: PricingVersion =
    profile.pricingVersion === 'modular-v2' ? 'modular-v2' : 'legacy-v1';

  const useModular =
    isModularEntitlementsEnabled() &&
    pricingVersion === 'modular-v2' &&
    profile.enabledModules &&
    Object.keys(profile.enabledModules).length > 0;

  const modules = useModular
    ? modularModulesFromProfile(profile)
    : legacyModulesForTier(tier, profile);

  return {
    source: useModular ? 'modular' : 'legacy',
    pricingVersion,
    tier,
    modules,
    businessWorkflow: workflowFromProfile(profile),
    startingPackage: profile.startingPackage ?? null,
    seatCount: Math.max(1, Number(profile.seatCount) || 1),
    posLocationCount: Math.max(0, Number(profile.posLocationCount) || 0),
    composedProductSource: profile.composedProductSource === 'pos' ? 'pos' : 'platform',
    limits: limitsFromProfile(tier, profile),
  };
}

export function canUseModule(
  profile: StoreProfile | null | undefined,
  moduleId: string,
): boolean {
  const entitlements = resolveStoreEntitlements(profile);
  if (!entitlements) return false;
  return Boolean(entitlements.modules[moduleId]);
}

/** Standalone Invoice Manager app — included with Invoicing & Billing or Invoice Manager module. */
export function canUseInvoiceManagerApp(profile: StoreProfile | null | undefined): boolean {
  return canUseModule(profile, 'invoicing') || canUseModule(profile, 'invoice_manager');
}
