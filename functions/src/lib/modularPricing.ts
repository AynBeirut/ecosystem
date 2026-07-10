import {
  MODULAR_SEAT_PRICING,
  PACKAGE_PRESETS,
  modulesRecordFromList,
  type StartingPackageKey,
} from './moduleManifest';
import { modularLimitsPatch } from './modularPackageLimits';

export type ModularBilling = 'monthly' | 'yearly';

/** Keep in sync with src/lib/modularPricing.ts MODULE_PRICES */
export const MODULE_PRICES: Record<string, { monthly: number; yearly: number }> = {
  invoicing:          { monthly: 5, yearly: 50 },
  marketplace:        { monthly: 4, yearly: 40 },
  analytics:          { monthly: 3, yearly: 30 },
  payments:           { monthly: 3, yearly: 30 },
  delivery:           { monthly: 3, yearly: 30 },
  stock:              { monthly: 3, yearly: 30 },
  crm:                { monthly: 8, yearly: 80 },
  factory:            { monthly: 6, yearly: 60 },
  restaurant:         { monthly: 4, yearly: 40 },
  pos:                { monthly: 4, yearly: 40 },
  invoice_manager:    { monthly: 3, yearly: 30 },
  team:               { monthly: 4, yearly: 40 },
  dropship:           { monthly: 3, yearly: 30 },
  services:           { monthly: 3, yearly: 30 },
  projects:           { monthly: 5, yearly: 50 },
  admin_mobile:       { monthly: 0, yearly: 0 },
  ai_builder:         { monthly: 8, yearly: 80 },
  ai_agent:           { monthly: 6, yearly: 60 },
  content_creator:    { monthly: 5, yearly: 50 },
  market_strategy:    { monthly: 5, yearly: 50 },
  email_marketing:    { monthly: 6, yearly: 60 },
  proposal_writer:    { monthly: 4, yearly: 40 },
  seo_assistant:      { monthly: 4, yearly: 40 },
  analytics_insights: { monthly: 3, yearly: 30 },
  campaign_writer:    { monthly: 4, yearly: 40 },
  builder:            { monthly: 6, yearly: 60 },
  blog_publisher:     { monthly: 3, yearly: 30 },
  whitelabel:         { monthly: 8, yearly: 80 },
};

/** Keep in sync with src/lib/pricingDisplay.ts ADDON_PRICING */
export const ADDON_PRICING: Record<string, { monthly: number; yearly: number }> = {
  domainPackage: { monthly: 10, yearly: 100 },
  whatsappBusiness: { monthly: 8, yearly: 80 },
  salesCrm: { monthly: 8, yearly: 80 },
  extraStorage: { monthly: 2, yearly: 20 },
};

export type CustomPriceBreakdown = {
  modulesUsd: number;
  extraSeatsUsd: number;
  extraPosUsd: number;
  addOnsUsd: number;
  totalUsd: number;
};

/** Single source of truth — mirrors src/lib/modularPricing.ts calculateCustomPrice + add-ons */
export function calculateCustomPrice(input: {
  moduleIds: string[];
  addOnKeys?: string[];
  seatCount: number;
  posLocationCount: number;
  billing: ModularBilling;
}): CustomPriceBreakdown {
  const { billing } = input;
  const seatCount = Math.max(1, input.seatCount);
  const posLocationCount = Math.max(0, input.posLocationCount);
  const extraSeats = Math.max(0, seatCount - 1);

  const seatRate = billing === 'yearly'
    ? MODULAR_SEAT_PRICING.extraUserYearlyUsd
    : MODULAR_SEAT_PRICING.extraUserMonthlyUsd;
  const posRate = billing === 'yearly'
    ? MODULAR_SEAT_PRICING.extraPosLocationYearlyUsd
    : MODULAR_SEAT_PRICING.extraPosLocationMonthlyUsd;

  const uniqueModuleIds = [...new Set(input.moduleIds.filter(Boolean))];
  const modulesUsd = uniqueModuleIds.reduce((sum, id) => {
    const price = MODULE_PRICES[id];
    if (!price) return sum;
    return sum + price[billing];
  }, 0);

  const extraSeatsUsd = extraSeats * seatRate;
  const hasPosModule = uniqueModuleIds.includes('pos');
  const extraPosLocations = hasPosModule ? Math.max(0, posLocationCount - 1) : 0;
  const extraPosUsd = extraPosLocations * posRate;

  const addOnKeys = [...new Set((input.addOnKeys || []).filter(Boolean))];
  const addOnsUsd = addOnKeys.reduce((sum, key) => {
    const price = ADDON_PRICING[key];
    return sum + (price ? price[billing] : 0);
  }, 0);

  return {
    modulesUsd,
    extraSeatsUsd,
    extraPosUsd,
    addOnsUsd,
    totalUsd: modulesUsd + extraSeatsUsd + extraPosUsd + addOnsUsd,
  };
}

export function calculateModularAmountCents(input: {
  moduleIds: string[];
  addOnKeys?: string[];
  seatCount: number;
  posLocationCount: number;
  billing: ModularBilling;
  presetLabel?: string;
}): { amountCents: number; totalUsd: number; description: string; breakdown: CustomPriceBreakdown } {
  const breakdown = calculateCustomPrice(input);
  const moduleCount = input.moduleIds.length;
  const label = input.presetLabel || 'Custom';
  const description = `Grabio ${label} modular (${moduleCount} modules, ${input.seatCount} users, ${input.posLocationCount} POS) - ${input.billing}`;
  return {
    amountCents: Math.round(breakdown.totalUsd * 100),
    totalUsd: breakdown.totalUsd,
    description,
    breakdown,
  };
}

function addOnMetaFromKeys(keys: string[]) {
  return {
    domainPackage: keys.includes('domainPackage'),
    whatsappBusiness: keys.includes('whatsappBusiness'),
    salesCrm: keys.includes('salesCrm'),
    extraStorageBlocks: keys.includes('extraStorage') ? 1 : 0,
  };
}

export function modularActivationPatch(input: {
  enabledModuleIds: string[];
  addOnKeys: string[];
  preset?: StartingPackageKey | 'custom' | null;
  seatCount: number;
  posLocationCount: number;
  billing: ModularBilling;
  amountCents: number;
}): Record<string, unknown> {
  const presetKey = input.preset && input.preset !== 'custom' ? input.preset : null;
  const preset = presetKey ? PACKAGE_PRESETS[presetKey] : null;
  const addOnMeta = addOnMetaFromKeys(input.addOnKeys);
  const addOnList = [...new Set(input.addOnKeys.filter((k) => ADDON_PRICING[k]))];
  const enabledModules = modulesRecordFromList(input.enabledModuleIds);
  const breakdown = calculateCustomPrice({
    moduleIds: input.enabledModuleIds,
    addOnKeys: input.addOnKeys,
    seatCount: input.seatCount,
    posLocationCount: input.posLocationCount,
    billing: input.billing,
  });
  const limitsProfile = {
    startingPackage: presetKey || undefined,
    enabledModules,
    modularMonthlyUsd: breakdown.totalUsd,
    addOns: addOnList,
    addOnsMeta: addOnMeta,
  };
  const limits = modularLimitsPatch(limitsProfile);

  return {
    pricingVersion: 'modular-v2',
    startingPackage: presetKey || 'custom',
    businessWorkflow: preset?.workflow ?? 'custom',
    enabledModules,
    seatCount: input.seatCount,
    posLocationCount: input.posLocationCount,
    subscriptionPlan: input.billing,
    composedProductSource: 'platform',
    addOns: addOnList,
    addOnsMeta: addOnMeta,
    modularMonthlyUsd: breakdown.totalUsd,
    productLimit: limits.productLimit,
    storageLimitMb: limits.storageLimitMb,
    storage_limit_mb: limits.storageLimitMb,
    allowsCatalogImages: limits.allowsCatalogImages,
    ...(addOnMeta.salesCrm ? { crmSettings: { noContactAlertDays: 7 } } : {}),
    pendingModularPreset: null,
    pendingModularBilling: null,
    pendingModularAmount: null,
    pendingModularSeats: null,
    pendingModularPosLocations: null,
    pendingModularEnabledModules: null,
    pendingModularAddOnKeys: null,
    lastModularPurchaseAt: new Date().toISOString(),
    lastModularPurchaseCents: input.amountCents,
  };
}

/** @deprecated preset-only pricing — do not use for checkout */
export function calculateModularAmountCentsLegacy(input: {
  preset: StartingPackageKey;
  seatCount: number;
  posLocationCount: number;
  billing: ModularBilling;
}): { amountCents: number; description: string } {
  const preset = PACKAGE_PRESETS[input.preset];
  const seatCount = Math.max(1, input.seatCount);
  const posCount = Math.max(0, input.posLocationCount);
  const includedPos = preset.defaultModules.includes('pos') ? 1 : 0;
  const extraSeats = Math.max(0, seatCount - 1);
  const extraPos = Math.max(0, posCount - includedPos);
  const seatRate = input.billing === 'yearly'
    ? MODULAR_SEAT_PRICING.extraUserYearlyUsd
    : MODULAR_SEAT_PRICING.extraUserMonthlyUsd;
  const posRate = input.billing === 'yearly'
    ? MODULAR_SEAT_PRICING.extraPosLocationYearlyUsd
    : MODULAR_SEAT_PRICING.extraPosLocationMonthlyUsd;
  const presetUsd = input.billing === 'yearly' ? preset.yearlyUsd : preset.monthlyUsd;
  const totalUsd = presetUsd + extraSeats * seatRate + extraPos * posRate;
  return {
    amountCents: Math.round(totalUsd * 100),
    description: `Grabio ${preset.label} modular-v2 (${seatCount} users, ${posCount} POS) - ${input.billing}`,
  };
}
