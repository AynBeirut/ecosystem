import { describe, expect, it } from 'vitest';
import { getAdminFeatureDenial, isAdminFeatureAllowed } from '@/lib/featureAccessGate';
import type { StoreEntitlements } from '@/lib/entitlements';

const baseEntitlements: StoreEntitlements = {
  source: 'modular',
  pricingVersion: 'modular-v2',
  tier: 'pro',
  modules: { pos: true, crm: true },
  businessWorkflow: 'live_kitchen',
  startingPackage: 'pkg_live_kitchen',
  seatCount: 1,
  posLocationCount: 1,
  composedProductSource: 'platform',
  limits: {
    productLimit: 100,
    storageLimitMb: 5120,
    monthlyOperationsLimit: null,
    allowsComposed: false,
    allowsManufacturing: false,
    allowsCatalogImages: true,
  },
};

const liveKitchenProfile = {
  businessWorkflow: 'live_kitchen' as const,
  venueOpsSettings: {
    restaurantFirstNavEnabled: true,
    enableBusinessFinance: true,
    enableStorefrontBuilder: true,
    enableSeoOps: true,
    enableFullInventory: true,
  },
};

describe('featureAccessGate', () => {
  it('blocks finance when not entitled even if venue toggle is on', () => {
    expect(
      isAdminFeatureAllowed('finance', liveKitchenProfile, baseEntitlements, {
        role: 'admin',
        subAccountRole: undefined,
        permissions: [],
      }),
    ).toBe(false);
    expect(getAdminFeatureDenial('finance', liveKitchenProfile, baseEntitlements)?.reason).toBe('not_entitled');
  });

  it('hides finance when entitled but venue toggle off', () => {
    const entitlements = { ...baseEntitlements, modules: { ...baseEntitlements.modules, invoicing: true } };
    const profile = {
      ...liveKitchenProfile,
      venueOpsSettings: { ...liveKitchenProfile.venueOpsSettings, enableBusinessFinance: false },
    };
    expect(
      isAdminFeatureAllowed('finance', profile, entitlements, { role: 'admin', permissions: [] }),
    ).toBe(false);
    expect(getAdminFeatureDenial('finance', profile, entitlements)?.reason).toBe('store_toggle');
  });

  it('blocks finance for cashier without finance permission', () => {
    const entitlements = { ...baseEntitlements, modules: { ...baseEntitlements.modules, invoicing: true } };
    expect(
      isAdminFeatureAllowed('finance', liveKitchenProfile, entitlements, {
        role: 'sub_account',
        subAccountRole: 'cashier',
        permissions: ['view_orders', 'process_payments'],
      }),
    ).toBe(false);
    expect(
      getAdminFeatureDenial('finance', liveKitchenProfile, entitlements, {
        role: 'sub_account',
        subAccountRole: 'cashier',
        permissions: ['view_orders'],
      })?.reason,
    ).toBe('permission');
  });

  it('blocks builder/SEO when not entitled even if grow toggles are on', () => {
    expect(isAdminFeatureAllowed('builder', liveKitchenProfile, baseEntitlements)).toBe(false);
    expect(isAdminFeatureAllowed('seo', liveKitchenProfile, baseEntitlements)).toBe(false);
  });

  it('allows manager finance only when entitled and toggled', () => {
    const entitlements = { ...baseEntitlements, modules: { ...baseEntitlements.modules, invoicing: true } };
    expect(
      isAdminFeatureAllowed('finance', liveKitchenProfile, entitlements, {
        role: 'sub_account',
        subAccountRole: 'manager',
        permissions: [],
      }),
    ).toBe(true);
  });
});
