import { describe, expect, it } from 'vitest';
import {
  canShowAdminCrmNav,
  canShowAdminFinanceNav,
  canShowAdminSeoNav,
  resolveEffectiveStoreContext,
} from '@/lib/effectiveStoreContext';
import type { StoreEntitlements } from '@/lib/entitlements';

const kitchenEntitlements: StoreEntitlements = {
  source: 'modular',
  pricingVersion: 'modular-v2',
  tier: 'pro',
  modules: { pos: true, crm: true, stock: true, builder: true, blog_publisher: true },
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

describe('resolveEffectiveStoreContext', () => {
  it('keeps legacy nav mode but hides unpaid modules', () => {
    const ctx = resolveEffectiveStoreContext({
      profile: {
        businessWorkflow: 'shop',
        startingPackage: 'pkg_shop',
        venueOpsSettings: { restaurantFirstNavEnabled: false },
      },
      entitlements: {
        ...kitchenEntitlements,
        modules: { pos: true, crm: true },
        businessWorkflow: 'shop',
        startingPackage: 'pkg_shop',
      },
      environment: 'web_admin',
    });
    expect(ctx.nav.mode).toBe('legacy');
    expect(ctx.modulesVisible.stock).toBe(false);
    expect(ctx.modulesVisible.finance).toBe(false);
  });

  it('applies live_kitchen restaurant-first defaults (finance/inventory hidden without entitlement or toggle)', () => {
    const ctx = resolveEffectiveStoreContext({
      profile: {
        businessWorkflow: 'live_kitchen',
        venueOpsSettings: { restaurantFirstNavEnabled: true },
      },
      entitlements: { ...kitchenEntitlements, modules: { pos: true, crm: true } },
      environment: 'web_admin',
    });
    expect(ctx.nav.mode).toBe('restaurant_first');
    expect(ctx.modulesVisible.stock).toBe(false);
    expect(ctx.modulesVisible.finance).toBe(false);
    expect(ctx.modulesVisible.crm).toBe(true);
  });

  it('does not show finance when toggle on but no finance modules', () => {
    const ctx = resolveEffectiveStoreContext({
      profile: {
        businessWorkflow: 'live_kitchen',
        venueOpsSettings: {
          restaurantFirstNavEnabled: true,
          enableBusinessFinance: true,
        },
      },
      entitlements: { ...kitchenEntitlements, modules: { pos: true, crm: true } },
      user: { role: 'admin', permissions: [] },
      environment: 'web_admin',
    });
    expect(canShowAdminFinanceNav(ctx)).toBe(false);
  });

  it('gates SEO and builder separately when toggles differ', () => {
    const ctx = resolveEffectiveStoreContext({
      profile: {
        businessWorkflow: 'live_kitchen',
        venueOpsSettings: {
          restaurantFirstNavEnabled: true,
          enableStorefrontBuilder: true,
          enableSeoOps: false,
        },
      },
      entitlements: kitchenEntitlements,
      user: { role: 'admin', permissions: [] },
      environment: 'web_admin',
    });
    expect(ctx.modulesVisible.storefrontBuilder).toBe(true);
    expect(ctx.modulesVisible.seoOps).toBe(false);
    expect(canShowAdminSeoNav(ctx, true)).toBe(false);
  });

  it('allows manager CRM only inside entitled + toggled CRM', () => {
    const ctx = resolveEffectiveStoreContext({
      profile: {
        businessWorkflow: 'live_kitchen',
        venueOpsSettings: { restaurantFirstNavEnabled: true, enableCrmPipeline: false },
      },
      entitlements: kitchenEntitlements,
      user: { role: 'sub_account', subAccountRole: 'manager', permissions: [] },
      environment: 'web_admin',
    });
    expect(ctx.modulesVisible.crm).toBe(false);
    expect(canShowAdminCrmNav(ctx, true)).toBe(false);
  });
});
