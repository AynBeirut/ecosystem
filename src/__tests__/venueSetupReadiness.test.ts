import { describe, expect, it } from 'vitest';
import { resolveVenueSetupTracks, shouldShowVenueSetupReadiness } from '@/lib/venueSetupReadiness';
import type { StoreEntitlements } from '@/lib/entitlements';

const kitchenEntitlements = {
  source: 'modular' as const,
  pricingVersion: 'modular-v2' as const,
  tier: 'pro' as const,
  modules: { pos: true, crm: true, stock: false },
  businessWorkflow: 'live_kitchen' as const,
  startingPackage: 'pkg_live_kitchen' as const,
  seatCount: 1,
  posLocationCount: 1,
  composedProductSource: 'platform' as const,
  limits: {
    productLimit: 100,
    storageLimitMb: 5120,
    monthlyOperationsLimit: null,
    allowsComposed: false,
    allowsManufacturing: false,
    allowsCatalogImages: true,
  },
};

describe('venueSetupReadiness', () => {
  it('returns tracks for live_kitchen stores', () => {
    const tracks = resolveVenueSetupTracks(
      { businessWorkflow: 'live_kitchen', name: 'Test', slug: 'test' },
      kitchenEntitlements as StoreEntitlements,
    );
    expect(tracks.length).toBeGreaterThan(5);
    expect(shouldShowVenueSetupReadiness({ businessWorkflow: 'live_kitchen' }, kitchenEntitlements as StoreEntitlements)).toBe(
      true,
    );
  });

  it('returns empty for generic shop workflow', () => {
    const tracks = resolveVenueSetupTracks(
      { businessWorkflow: 'shop', storeName: 'Shop' },
      { ...kitchenEntitlements, businessWorkflow: 'shop', startingPackage: 'pkg_shop' } as StoreEntitlements,
    );
    expect(tracks).toEqual([]);
  });

  it('marks client import not_started without queue items', () => {
    const tracks = resolveVenueSetupTracks(
      { businessWorkflow: 'live_kitchen', venueSetupIntake: { pendingItems: [] } },
      kitchenEntitlements as StoreEntitlements,
    );
    const intake = tracks.find((t) => t.id === 'client_data_import');
    expect(intake?.status).toBe('not_started');
  });
});
