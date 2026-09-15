import { describe, expect, it } from 'vitest';
import { resolveVenueOpsNavFlags } from '@/lib/venueOpsNav';

describe('resolveVenueOpsNavFlags', () => {
  it('keeps legacy full nav when restaurantFirstNavEnabled is false', () => {
    const flags = resolveVenueOpsNavFlags({
      businessWorkflow: 'live_kitchen',
      startingPackage: 'pkg_live_kitchen',
      venueOpsSettings: { restaurantFirstNavEnabled: false },
    });
    expect(flags.mode).toBe('legacy');
    expect(flags.showInventoryNav).toBe(true);
    expect(flags.showBusinessFinanceNav).toBe(true);
  });

  it('applies live_kitchen defaults when restaurant-first nav is enabled', () => {
    const flags = resolveVenueOpsNavFlags({
      businessWorkflow: 'live_kitchen',
      venueOpsSettings: { restaurantFirstNavEnabled: true },
    });
    expect(flags.mode).toBe('restaurant_first');
    expect(flags.showInventoryNav).toBe(false);
    expect(flags.showBusinessFinanceNav).toBe(false);
    expect(flags.showCrmNav).toBe(true);
    expect(flags.useOperationsFirstLayout).toBe(true);
  });

  it('allows overrides when restaurant-first nav is enabled', () => {
    const flags = resolveVenueOpsNavFlags({
      businessWorkflow: 'live_kitchen',
      venueOpsSettings: {
        restaurantFirstNavEnabled: true,
        enableFullInventory: true,
        enableBusinessFinance: true,
      },
    });
    expect(flags.showInventoryNav).toBe(true);
    expect(flags.showBusinessFinanceNav).toBe(true);
  });
});
