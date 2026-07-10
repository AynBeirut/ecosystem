import { calculateCustomPrice } from '@/lib/modularPricing';
import { PACKAGE_PRESETS, type StartingPackageKey } from '@/lib/moduleManifest';
import { normalizeAddOnsFromProfile } from '@/lib/pricingDisplay';
import type { StoreProfile } from '@/types/storeProfile';

/** Paid Shop base — 50 products at $27/mo; +10 products per additional $10/mo (37→60, 47→70, …). */
export const SHOP_BASE_MONTHLY_USD = 27;
export const SHOP_BASE_PRODUCT_LIMIT = 50;
export const PRODUCT_BOOST_STEP_USD = 10;
export const PRODUCT_BOOST_COUNT = 10;

const EXTRA_STORAGE_BLOCK_MB = 5120;

export const CORE_ENTRY_PACKAGES: StartingPackageKey[] = [
  'pkg_invoice',
  'pkg_mini_shop',
  'pkg_business_backend',
  'pkg_shop',
];

export const INDUSTRY_PACKAGES: StartingPackageKey[] = [
  'pkg_live_kitchen',
  'pkg_factory_flow',
  'pkg_ngo',
  'pkg_freelancer',
];

export function presetLimitLines(key: StartingPackageKey): string[] {
  switch (key) {
    case 'pkg_invoice':
      return ['500 MB storage', 'Invoices & PDFs', 'No product catalog'];
    case 'pkg_mini_shop':
      return ['1 GB storage', '15 products', 'Small product images'];
    case 'pkg_business_backend':
      return ['1 GB storage', '50 products', 'No product images'];
    case 'pkg_shop':
      return ['3 GB storage', '50 products (+10 per $10/mo)', 'Full storefront'];
    case 'pkg_live_kitchen':
      return ['3 GB storage', '50 products (+10 per $10/mo)', 'Kitchen + POS'];
    case 'pkg_factory_flow':
      return ['3 GB storage', '50 products (+10 per $10/mo)', 'Manufacturing'];
    case 'pkg_ngo':
      return ['500 MB storage', 'Invoicing only', 'No catalog'];
    case 'pkg_freelancer':
      return ['500 MB storage', 'Invoicing only', 'No catalog'];
    default:
      return [];
  }
}

export function resolveModularAllowsCatalogImages(profile: StoreProfile): boolean {
  if (typeof profile.allowsCatalogImages === 'boolean') {
    return profile.allowsCatalogImages;
  }
  if (profile.startingPackage === 'pkg_business_backend') {
    return false;
  }
  return true;
}

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

export function expandedShopProductLimit(monthlyUsd: number): number {
  const extraBuckets = Math.floor(Math.max(0, monthlyUsd - SHOP_BASE_MONTHLY_USD) / PRODUCT_BOOST_STEP_USD);
  return SHOP_BASE_PRODUCT_LIMIT + extraBuckets * PRODUCT_BOOST_COUNT;
}

export function estimateModularMonthlyUsd(profile: StoreProfile): number {
  if (typeof profile.modularMonthlyUsd === 'number' && profile.modularMonthlyUsd > 0) {
    return profile.modularMonthlyUsd;
  }

  const enabled = profile.enabledModules ?? {};
  const moduleIds = Object.entries(enabled)
    .filter(([, on]) => Boolean(on))
    .map(([id]) => id);

  if (moduleIds.length === 0 && profile.startingPackage && PACKAGE_PRESETS[profile.startingPackage]) {
    return PACKAGE_PRESETS[profile.startingPackage].monthlyUsd;
  }

  const addOns = normalizeAddOnsFromProfile(profile.addOns ?? profile.addOnsMeta);
  const addOnKeys: string[] = [];
  if (addOns.domainPackage) addOnKeys.push('domainPackage');
  if (addOns.whatsappBusiness) addOnKeys.push('whatsappBusiness');
  if (addOns.salesCrm) addOnKeys.push('salesCrm');
  if (addOns.extraStorageBlocks > 0) addOnKeys.push('extraStorage');

  return calculateCustomPrice({
    moduleIds,
    addOnKeys,
    seatCount: Math.max(1, Number(profile.seatCount) || 1),
    posLocationCount: Math.max(0, Number(profile.posLocationCount) || 0),
    billing: 'monthly',
  }).totalUsd;
}

export function resolveModularProductLimit(profile: StoreProfile): number | null {
  if (typeof profile.productLimit === 'number') {
    return profile.productLimit;
  }

  const pkg = profile.startingPackage;
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

export function resolveModularStorageLimitMb(profile: StoreProfile): number {
  const addOns = normalizeAddOnsFromProfile(profile.addOns ?? profile.addOnsMeta);
  const extraBlocks = Math.max(0, Number(addOns.extraStorageBlocks) || 0);

  const explicit = profile.storageLimitMb ?? profile.storage_limit_mb;
  if (typeof explicit === 'number' && explicit > 0) {
    return explicit + extraBlocks * EXTRA_STORAGE_BLOCK_MB;
  }

  const pkg = profile.startingPackage;
  const base = (pkg && MODULAR_STORAGE_MB[pkg]) || 500;
  return base + extraBlocks * EXTRA_STORAGE_BLOCK_MB;
}

/** Fields to merge on storeProfiles when a modular plan is saved or activated. */
export function modularLimitsPatch(profile: StoreProfile): Pick<
  StoreProfile,
  'productLimit' | 'storageLimitMb' | 'allowsCatalogImages'
> {
  return {
    productLimit: resolveModularProductLimit(profile) ?? undefined,
    storageLimitMb: resolveModularStorageLimitMb(profile),
    allowsCatalogImages: resolveModularAllowsCatalogImages(profile),
  };
}

export function formatProductLimitLabel(limit: number | null): string {
  if (limit === null) return 'Unlimited';
  if (limit === 0) return 'No product catalog';
  return `${limit} products`;
}
