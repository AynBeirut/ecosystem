import { describe, expect, it } from 'vitest';
import { canConfigureVenueOpsSettings, mergeVenueOpsSettingsPatch } from '@/lib/venueOpsSettingsUi';
import { getEffectiveVenueOpsSettings } from '@/lib/venueOpsNav';

describe('venueOpsSettingsUi', () => {
  it('shows panel only for live kitchen stores', () => {
    expect(canConfigureVenueOpsSettings({ businessWorkflow: 'live_kitchen', startingPackage: 'pkg_shop' })).toBe(true);
    expect(canConfigureVenueOpsSettings({ businessWorkflow: 'shop', startingPackage: 'pkg_shop' })).toBe(false);
    expect(canConfigureVenueOpsSettings({ businessWorkflow: 'shop', startingPackage: 'pkg_live_kitchen' })).toBe(true);
  });

  it('merges venue ops patches', () => {
    expect(mergeVenueOpsSettingsPatch({ enableCrmPipeline: true }, { enableFullInventory: true })).toEqual({
      enableCrmPipeline: true,
      enableFullInventory: true,
    });
  });

  it('effective settings use live kitchen defaults when enabled', () => {
    const effective = getEffectiveVenueOpsSettings({
      businessWorkflow: 'live_kitchen',
      startingPackage: 'pkg_live_kitchen',
      venueOpsSettings: { restaurantFirstNavEnabled: true },
    });
    expect(effective?.enableCrmPipeline).toBe(true);
    expect(effective?.enableFullInventory).toBe(false);
  });
});
