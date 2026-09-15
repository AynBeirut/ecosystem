import type { StoreProfile, VenueOpsSettings } from '@/types/storeProfile';

export type VenueOpsNavMode = 'legacy' | 'restaurant_first';

export type VenueOpsNavFlags = {
  mode: VenueOpsNavMode;
  showInventoryNav: boolean;
  showBusinessFinanceNav: boolean;
  showCrmNav: boolean;
  showReservationsNav: boolean;
  showStorefrontGrowNav: boolean;
  showSeoNav: boolean;
  /** Operations group first; optional stock group after. */
  useOperationsFirstLayout: boolean;
  operationsGroupTitle: string;
  stockGroupTitle: string;
};

const LIVE_KITCHEN_NAV_DEFAULTS: VenueOpsSettings = {
  enableFullInventory: false,
  enableBusinessFinance: false,
  enableCrmPipeline: true,
  enableReservationsHub: true,
  enableStorefrontBuilder: false,
  enableSeoOps: false,
};

const LEGACY_NAV_DEFAULTS: VenueOpsSettings = {
  enableFullInventory: true,
  enableBusinessFinance: true,
  enableCrmPipeline: true,
  enableReservationsHub: true,
  enableStorefrontBuilder: true,
  enableSeoOps: true,
};

function isLiveKitchenWorkflow(profile: Pick<StoreProfile, 'businessWorkflow' | 'startingPackage'> | null | undefined): boolean {
  return (
    profile?.businessWorkflow === 'live_kitchen' || profile?.startingPackage === 'pkg_live_kitchen'
  );
}

function mergeVenueOpsSettings(
  base: VenueOpsSettings,
  overrides?: VenueOpsSettings,
): VenueOpsSettings {
  return {
    enableFullInventory: overrides?.enableFullInventory ?? base.enableFullInventory,
    enableBusinessFinance: overrides?.enableBusinessFinance ?? base.enableBusinessFinance,
    enableCrmPipeline: overrides?.enableCrmPipeline ?? base.enableCrmPipeline,
    enableReservationsHub: overrides?.enableReservationsHub ?? base.enableReservationsHub,
    enableStorefrontBuilder: overrides?.enableStorefrontBuilder ?? base.enableStorefrontBuilder,
    enableSeoOps: overrides?.enableSeoOps ?? base.enableSeoOps,
  };
}

/** Effective module toggles when restaurant-first nav is on (for Store Profile UI). */
export function getEffectiveVenueOpsSettings(
  profile: Pick<StoreProfile, 'businessWorkflow' | 'startingPackage' | 'venueOpsSettings'> | null | undefined,
): VenueOpsSettings | null {
  if (!profile?.venueOpsSettings?.restaurantFirstNavEnabled) return null;
  const baseDefaults = isLiveKitchenWorkflow(profile) ? LIVE_KITCHEN_NAV_DEFAULTS : LEGACY_NAV_DEFAULTS;
  return mergeVenueOpsSettings(baseDefaults, profile.venueOpsSettings);
}

/**
 * Resolves admin nav visibility for restaurant-first IA.
 * Existing tenants: legacy (full nav) until `venueOpsSettings.restaurantFirstNavEnabled` is true.
 */
export function resolveVenueOpsNavFlags(
  profile: Pick<StoreProfile, 'businessWorkflow' | 'startingPackage' | 'venueOpsSettings'> | null | undefined,
): VenueOpsNavFlags {
  if (!profile?.venueOpsSettings?.restaurantFirstNavEnabled) {
    return {
      mode: 'legacy',
      showInventoryNav: true,
      showBusinessFinanceNav: true,
      showCrmNav: true,
      showReservationsNav: true,
      showStorefrontGrowNav: true,
      showSeoNav: true,
      useOperationsFirstLayout: false,
      operationsGroupTitle: 'Sales & Customers',
      stockGroupTitle: 'Stock & Catalog',
    };
  }

  const baseDefaults = isLiveKitchenWorkflow(profile) ? LIVE_KITCHEN_NAV_DEFAULTS : LEGACY_NAV_DEFAULTS;
  const effective = mergeVenueOpsSettings(baseDefaults, profile.venueOpsSettings);

  return {
    mode: 'restaurant_first',
    showInventoryNav: Boolean(effective.enableFullInventory),
    showBusinessFinanceNav: Boolean(effective.enableBusinessFinance),
    showCrmNav: Boolean(effective.enableCrmPipeline),
    showReservationsNav: Boolean(effective.enableReservationsHub),
    showStorefrontGrowNav: Boolean(effective.enableStorefrontBuilder),
    showSeoNav: Boolean(effective.enableSeoOps),
    useOperationsFirstLayout: true,
    operationsGroupTitle: 'Operations',
    stockGroupTitle: 'Kitchen & stock',
  };
}
