import { describe, expect, it } from 'vitest';
import {
  canAccessRestaurantFinance,
  canAccessSeoOps,
  canAccessVenueOperations,
  resolveVenueRoleTemplate,
} from '@/lib/restaurantRolePolicy';

describe('restaurantRolePolicy', () => {
  it('maps manager to venue_manager template', () => {
    expect(
      resolveVenueRoleTemplate({ role: 'sub_account', subAccountRole: 'manager', permissions: [] }),
    ).toBe('venue_manager');
  });

  it('allows venue ops for cashier but not web_maintenance', () => {
    expect(
      canAccessVenueOperations({ role: 'sub_account', subAccountRole: 'cashier', permissions: [] }),
    ).toBe(true);
    expect(
      canAccessVenueOperations({ role: 'sub_account', subAccountRole: 'web_maintenance', permissions: [] }),
    ).toBe(false);
  });

  it('keeps finance for manager and accounting freelancer only', () => {
    expect(
      canAccessRestaurantFinance({ role: 'sub_account', subAccountRole: 'manager', permissions: [] }),
    ).toBe(true);
    expect(
      canAccessRestaurantFinance({ role: 'sub_account', subAccountRole: 'accounting', permissions: [] }),
    ).toBe(true);
    expect(
      canAccessRestaurantFinance({ role: 'sub_account', subAccountRole: 'cashier', permissions: [] }),
    ).toBe(false);
  });

  it('blocks SEO ops for web_maintenance sub-account', () => {
    expect(
      canAccessSeoOps({ role: 'sub_account', subAccountRole: 'web_maintenance', permissions: [] }),
    ).toBe(false);
    expect(
      canAccessSeoOps({ role: 'sub_account', subAccountRole: 'manager', permissions: [] }),
    ).toBe(true);
  });
});
