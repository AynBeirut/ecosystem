import { calculateCustomPrice } from './modularPricing';
import { PACKAGE_PRESETS, type StartingPackageKey } from './moduleManifest';

/** Paid Shop base — 50 products at $27/mo; +10 products per additional $10/mo (37→60, 47→70, …). */
export const SHOP_BASE_MONTHLY_USD = 27;
export const SHOP_BASE_PRODUCT_LIMIT = 50;
export const PRODUCT_BOOST_STEP_USD = 10;
export const PRODUCT_BOOST_COUNT = 10;

const EXTRA_STORAGE_BLOCK_MB = 5120;

export const MODULAR_STORAGE_MB: Record<StartingPackageKey, number> = {
  pkg_invoice: 500,
  pkg_mini_shop: 1024,
  pkg_business_backend: 1024,
  pkg_shop: 3072,
  pkg_live_kitchen: 3072,
  pkg_factory_flow: 3072,
  pkg_ngo: 500,
  pkg_freelancer: 500,
};

export const MODULAR_BASE_PRODUCT_LIMIT: Partial<Record<StartingPackageKey, number>> = {
  pkg_invoice: 0,
  pkg_mini_shop: 15,
  pkg_business_backend: 50,
  pkg_shop: SHOP_BASE_PRODUCT_LIMIT,
  pkg_live_kitchen: SHOP_BASE_PRODUCT_LIMIT,
  pkg_factory_flow: SHOP_BASE_PRODUCT_LIMIT,
  pkg_ngo: 0,
  pkg_freelancer: 0,
};

type LimitsProfile = {
  startingPackage?: StartingPackageKey | string;
  modularMonthlyUsd?: number;
  productLimit?: number;
  storageLimitMb?: number;
  storage_limit_mb?: number;
  enabledModules?: Record<string, boolean>;
  addOns?: string[];
  addOnsMeta?: {
    domainPackage?: boolean;
    whatsappBusiness?: boolean;
    salesCrm?: boolean;
    extraStorageBlocks?: number;
  };
};

export function expandedShopProductLimit(monthlyUsd: number): number {
  const extraBuckets = Math.floor(Math.max(0, monthlyUsd - SHOP_BASE_MONTHLY_USD) / PRODUCT_BOOST_STEP_USD);
  return SHOP_BASE_PRODUCT_LIMIT + extraBuckets * PRODUCT_BOOST_COUNT;
}

function normalizeAddOnsFromProfile(
  addOns?: string[] | { extraStorageBlocks?: number },
): { extraStorageBlocks: number } {
  if (Array.isArray(addOns)) {
    return { extraStorageBlocks: addOns.includes('extraStorage') ? 1 : 0 };
  }
  return { extraStorageBlocks: Math.max(0, Number(addOns?.extraStorageBlocks) || 0) };
}

export function estimateModularMonthlyUsd(profile: LimitsProfile): number {
  if (typeof profile.modularMonthlyUsd === 'number' && profile.modularMonthlyUsd > 0) {
    return profile.modularMonthlyUsd;
  }

  const enabled = profile.enabledModules ?? {};
  const moduleIds = Object.entries(enabled)
    .filter(([, on]) => Boolean(on))
    .map(([id]) => id);

  const pkg = profile.startingPackage;
  if (moduleIds.length === 0 && pkg && pkg in PACKAGE_PRESETS) {
    return PACKAGE_PRESETS[pkg as StartingPackageKey].monthlyUsd;
  }

  const addOns = normalizeAddOnsFromProfile(profile.addOns ?? profile.addOnsMeta);
  const addOnKeys: string[] = [];
  if (profile.addOnsMeta?.domainPackage) addOnKeys.push('domainPackage');
  if (profile.addOnsMeta?.whatsappBusiness) addOnKeys.push('whatsappBusiness');
  if (profile.addOnsMeta?.salesCrm) addOnKeys.push('salesCrm');
  if (addOns.extraStorageBlocks > 0) addOnKeys.push('extraStorage');

  return calculateCustomPrice({
    moduleIds,
    addOnKeys,
    seatCount: 1,
    posLocationCount: 0,
    billing: 'monthly',
  }).totalUsd;
}

export function resolveModularProductLimit(profile: LimitsProfile): number | null {
  if (typeof profile.productLimit === 'number') {
    return profile.productLimit;
  }

  const pkg = profile.startingPackage as StartingPackageKey | undefined;
  const monthlyUsd = estimateModularMonthlyUsd(profile);

  if (pkg && MODULAR_BASE_PRODUCT_LIMIT[pkg] !== undefined) {
    const base = MODULAR_BASE_PRODUCT_LIMIT[pkg]!;
    if (base === SHOP_BASE_PRODUCT_LIMIT || pkg === 'pkg_live_kitchen' || pkg === 'pkg_factory_flow') {
      return expandedShopProductLimit(monthlyUsd);
    }
    return base;
  }

  if (monthlyUsd >= SHOP_BASE_MONTHLY_USD) {
    return expandedShopProductLimit(monthlyUsd);
  }
  if (monthlyUsd >= 19) {
    return 50;
  }
  if (profile.enabledModules?.marketplace) {
    return 15;
  }
  if (profile.enabledModules?.invoicing && !profile.enabledModules?.marketplace) {
    return 0;
  }

  return 10;
}

export function resolveModularStorageLimitMb(profile: LimitsProfile): number {
  const addOns = normalizeAddOnsFromProfile(profile.addOns ?? profile.addOnsMeta);
  const extraBlocks = Math.max(0, Number(addOns.extraStorageBlocks) || 0);

  const explicit = profile.storageLimitMb ?? profile.storage_limit_mb;
  if (typeof explicit === 'number' && explicit > 0) {
    return explicit + extraBlocks * EXTRA_STORAGE_BLOCK_MB;
  }

  const pkg = profile.startingPackage as StartingPackageKey | undefined;
  const base = (pkg && MODULAR_STORAGE_MB[pkg]) || 500;
  return base + extraBlocks * EXTRA_STORAGE_BLOCK_MB;
}

export function resolveModularAllowsCatalogImages(profile: LimitsProfile): boolean {
  if (typeof (profile as { allowsCatalogImages?: boolean }).allowsCatalogImages === 'boolean') {
    return (profile as { allowsCatalogImages: boolean }).allowsCatalogImages;
  }
  if (profile.startingPackage === 'pkg_business_backend') {
    return false;
  }
  return true;
}

export function modularLimitsPatch(profile: LimitsProfile): {
  productLimit: number | null;
  storageLimitMb: number;
  allowsCatalogImages: boolean;
} {
  return {
    productLimit: resolveModularProductLimit(profile),
    storageLimitMb: resolveModularStorageLimitMb(profile),
    allowsCatalogImages: resolveModularAllowsCatalogImages(profile),
  };
}
