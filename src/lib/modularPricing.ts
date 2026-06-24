import type { StartingPackageKey } from '@/lib/moduleManifest';
import { MODULAR_SEAT_PRICING, PACKAGE_PRESETS } from '@/lib/moduleManifest';
import { ADDON_PRICING, type AddOnKey } from '@/lib/pricingDisplay';

export type ModularBillingCycle = 'monthly' | 'yearly';

/**
 * Per-module à-la-carte prices for Custom mode.
 * Presets are bundled at a discount vs these individual prices.
 */
/**
 * Per-module à-la-carte monthly/yearly prices (USD).
 * Target: core 6-module shop ≈ $21/mo — competitive with Odoo Standard ($24.90/user).
 * POS price covers the first location; extra locations use MODULAR_SEAT_PRICING.
 */
export const MODULE_PRICES: Record<string, { monthly: number; yearly: number }> = {
  // Core platform
  invoicing:          { monthly: 5, yearly: 50 },
  marketplace:        { monthly: 4, yearly: 40 },
  analytics:          { monthly: 3, yearly: 30 },
  payments:           { monthly: 3, yearly: 30 },
  delivery:           { monthly: 3, yearly: 30 },
  stock:              { monthly: 3, yearly: 30 },
  // Business apps
  crm:                { monthly: 8, yearly: 80 },
  factory:            { monthly: 6, yearly: 60 },
  restaurant:         { monthly: 4, yearly: 40 },
  pos:                { monthly: 4, yearly: 40 }, // first location included
  invoice_manager:    { monthly: 3, yearly: 30 },
  team:               { monthly: 4, yearly: 40 },
  dropship:           { monthly: 3, yearly: 30 },
  services:           { monthly: 3, yearly: 30 },
  projects:           { monthly: 5, yearly: 50 },
  // Always free
  admin_mobile:       { monthly: 0, yearly: 0  },
  // AI & future
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

export type CustomPriceBreakdown = {
  modulesUsd: number;
  extraSeatsUsd: number;
  extraPosUsd: number;
  addOnsUsd: number;
  totalUsd: number;
};

export function calculateCustomPrice(input: {
  moduleIds: string[];
  addOnKeys?: string[];
  seatCount: number;
  posLocationCount: number;
  billing: ModularBillingCycle;
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

  const modulesUsd = input.moduleIds.reduce((sum, id) => {
    const price = MODULE_PRICES[id];
    return sum + (price ? price[billing] : 0);
  }, 0);

  const extraSeatsUsd = extraSeats * seatRate;

  // POS: first location is included in MODULE_PRICES['pos'].
  // Extra locations are charged only when POS module is selected.
  const hasPosModule = input.moduleIds.includes('pos');
  const extraPosLocations = hasPosModule ? Math.max(0, posLocationCount - 1) : 0;
  const extraPosUsd = extraPosLocations * posRate;

  const addOnKeys = [...new Set((input.addOnKeys || []).filter(Boolean))];
  const addOnsUsd = addOnKeys.reduce((sum, key) => {
    const pricing = ADDON_PRICING[key as AddOnKey];
    return sum + (pricing ? pricing[billing] : 0);
  }, 0);

  return {
    modulesUsd,
    extraSeatsUsd,
    extraPosUsd,
    addOnsUsd,
    totalUsd: modulesUsd + extraSeatsUsd + extraPosUsd + addOnsUsd,
  };
}

export type ModularCheckoutInput = {
  preset: StartingPackageKey;
  seatCount: number;
  posLocationCount: number;
  billing: ModularBillingCycle;
};

export type ModularPriceBreakdown = {
  presetUsd: number;
  extraSeatsUsd: number;
  extraPosUsd: number;
  totalUsd: number;
  seatCount: number;
  posLocationCount: number;
  includedPosLocations: number;
};

export function calculateModularPrice(input: ModularCheckoutInput): ModularPriceBreakdown {
  const preset = PACKAGE_PRESETS[input.preset];
  const seatCount = Math.max(1, input.seatCount);
  const posLocationCount = Math.max(0, input.posLocationCount);
  const includedPos = preset.defaultModules.includes('pos') ? 1 : 0;
  const extraSeats = Math.max(0, seatCount - 1);
  const extraPos = Math.max(0, posLocationCount - includedPos);

  const seatRate =
    input.billing === 'yearly'
      ? MODULAR_SEAT_PRICING.extraUserYearlyUsd
      : MODULAR_SEAT_PRICING.extraUserMonthlyUsd;
  const posRate =
    input.billing === 'yearly'
      ? MODULAR_SEAT_PRICING.extraPosLocationYearlyUsd
      : MODULAR_SEAT_PRICING.extraPosLocationMonthlyUsd;
  const presetRate = input.billing === 'yearly' ? preset.yearlyUsd : preset.monthlyUsd;

  const extraSeatsUsd = extraSeats * seatRate;
  const extraPosUsd = extraPos * posRate;

  return {
    presetUsd: presetRate,
    extraSeatsUsd,
    extraPosUsd,
    totalUsd: presetRate + extraSeatsUsd + extraPosUsd,
    seatCount,
    posLocationCount,
    includedPosLocations: includedPos,
  };
}

/** Whish/Stripe amounts are in cents */
export function modularTotalCents(breakdown: ModularPriceBreakdown): number {
  return Math.round(breakdown.totalUsd * 100);
}

export function formatModularTotal(breakdown: ModularPriceBreakdown, billing: ModularBillingCycle): string {
  const suffix = billing === 'yearly' ? '/yr' : '/mo';
  return `$${breakdown.totalUsd}${suffix}`;
}
