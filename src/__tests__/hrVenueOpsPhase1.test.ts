import { describe, expect, it } from 'vitest';
import {
  getAdminPathFeatureDenial,
  isAdminFeatureAllowed,
  legacyHrRouteKind,
  resolveGatedFeatureForAdminPath,
  staffPayrollShortcutVisible,
} from '@/lib/featureAccessGate';
import { resolveEffectiveStoreContext } from '@/lib/effectiveStoreContext';
import { hrVenueOpsNavVisibility, visibleHrShellSections } from '@/lib/hrVenueOpsShell';
import type { StoreEntitlements } from '@/lib/entitlements';

const owner = { role: 'admin' as const, permissions: [] as string[] };

const financeOffEntitlements: StoreEntitlements = {
  source: 'modular',
  pricingVersion: 'modular-v2',
  tier: 'pro',
  modules: { pos: true, crm: true, team: true, restaurant: true },
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

const financeOffProfile = {
  businessWorkflow: 'live_kitchen' as const,
  startingPackage: 'pkg_live_kitchen' as const,
  venueOpsSettings: {
    restaurantFirstNavEnabled: true,
    enableBusinessFinance: false,
    enableFullInventory: false,
  },
};

describe('HR and Venue Ops phase 1 gates', () => {
  it('shows HR and Venue Ops when finance and inventory are off', () => {
    const nav = hrVenueOpsNavVisibility({
      profile: financeOffProfile,
      entitlements: financeOffEntitlements,
      user: owner,
    });
    expect(nav.hr).toBe(true);
    expect(nav.venueOps).toBe(true);
    expect(nav.payroll).toBe(false);
    expect(staffPayrollShortcutVisible(true, financeOffProfile, financeOffEntitlements, owner)).toBe(false);
    expect(nav.financeLinks).toBe(false);
    expect(nav.inventoryLinks).toBe(false);
    expect(visibleHrShellSections({
      profile: financeOffProfile,
      entitlements: financeOffEntitlements,
      user: owner,
    }).some((section) => section.id === 'payroll')).toBe(false);
  });

  it('hides payroll on the HR shell until finance is entitled and toggled', () => {
    const entitlements = {
      ...financeOffEntitlements,
      modules: { ...financeOffEntitlements.modules, invoicing: true, stock: true },
    };
    const profile = {
      ...financeOffProfile,
      venueOpsSettings: {
        ...financeOffProfile.venueOpsSettings,
        enableBusinessFinance: true,
        enableFullInventory: false,
      },
    };
    const nav = hrVenueOpsNavVisibility({ profile, entitlements, user: owner });
    expect(nav.payroll).toBe(true);
    expect(staffPayrollShortcutVisible(true, profile, entitlements, owner)).toBe(true);
    expect(nav.financeLinks).toBe(true);
    expect(nav.inventoryLinks).toBe(false);
    expect(visibleHrShellSections({ profile, entitlements, user: owner }).some((section) => section.id === 'payroll')).toBe(true);
    expect(getAdminPathFeatureDenial('/admin/hr/payroll', profile, entitlements, owner)).toBeNull();
  });

  it('requires team entitlement, the HR toggle, and a manager for HR', () => {
    const noTeam = {
      ...financeOffEntitlements,
      modules: { ...financeOffEntitlements.modules, team: false },
    };
    expect(isAdminFeatureAllowed('hr', financeOffProfile, noTeam, owner)).toBe(false);
    expect(getAdminPathFeatureDenial('/admin/hr', financeOffProfile, noTeam, owner)?.reason).toBe('not_entitled');

    const hrOff = {
      ...financeOffProfile,
      venueOpsSettings: { ...financeOffProfile.venueOpsSettings, enableOfficialHr: false },
    };
    expect(getAdminPathFeatureDenial('/admin/hr', hrOff, financeOffEntitlements, owner)?.reason).toBe('store_toggle');

    expect(
      getAdminPathFeatureDenial('/admin/hr', financeOffProfile, financeOffEntitlements, {
        role: 'sub_account',
        subAccountRole: 'cashier',
        permissions: ['view_orders'],
      })?.reason,
    ).toBe('permission');
  });

  it('lets floor staff open Venue Ops and keeps them out of HR', () => {
    const cashier = {
      role: 'sub_account' as const,
      subAccountRole: 'cashier' as const,
      permissions: ['view_orders'],
    };
    expect(isAdminFeatureAllowed('venue_ops', financeOffProfile, financeOffEntitlements, cashier)).toBe(true);
    expect(isAdminFeatureAllowed('hr', financeOffProfile, financeOffEntitlements, cashier)).toBe(false);
    expect(isAdminFeatureAllowed('payroll', financeOffProfile, financeOffEntitlements, cashier)).toBe(false);
  });

  it('keeps old payroll routes on finance and leaves daily presence ungated', () => {
    expect(legacyHrRouteKind('/admin/staff')).toBe('payroll');
    expect(legacyHrRouteKind('/admin/salaries')).toBe('payroll');
    expect(legacyHrRouteKind('/admin/staff-presence')).toBe('attendance');
    expect(resolveGatedFeatureForAdminPath('/admin/staff')).toBe('finance');
    expect(resolveGatedFeatureForAdminPath('/admin/salaries')).toBe('finance');
    expect(resolveGatedFeatureForAdminPath('/admin/staff-presence')).toBeNull();
    expect(getAdminPathFeatureDenial('/admin/staff', financeOffProfile, financeOffEntitlements, owner)?.feature).toBe('finance');
    expect(getAdminPathFeatureDenial('/admin/staff-presence', financeOffProfile, financeOffEntitlements, owner)).toBeNull();
  });

  it('gates the new hubs and still gates invoice documents and theme separately', () => {
    expect(resolveGatedFeatureForAdminPath('/admin/hr')).toBe('hr');
    expect(resolveGatedFeatureForAdminPath('/admin/hr/employees')).toBe('hr');
    expect(resolveGatedFeatureForAdminPath('/admin/hr/payroll')).toBe('payroll');
    expect(resolveGatedFeatureForAdminPath('/admin/venue-ops/allergens')).toBe('venue_ops');
    expect(resolveGatedFeatureForAdminPath('/admin/finance/invoice-document')).toBe('finance');
    expect(resolveGatedFeatureForAdminPath('/admin/theme-editor')).toBe('builder');
    expect(
      getAdminPathFeatureDenial('/admin/hr/payroll', financeOffProfile, financeOffEntitlements, owner)?.feature,
    ).toBe('payroll');
  });

  it('does not show the new hubs on a classic menu unless the store turns them on', () => {
    const ctx = resolveEffectiveStoreContext({
      profile: {
        businessWorkflow: 'shop',
        startingPackage: 'pkg_shop',
        venueOpsSettings: { restaurantFirstNavEnabled: false },
      },
      entitlements: financeOffEntitlements,
      user: owner,
      environment: 'web_admin',
    });
    expect(ctx.modulesVisible.hr).toBe(false);
    expect(ctx.modulesVisible.venueOps).toBe(false);
    expect(ctx.modulesVisible.finance).toBe(false);
  });
});
