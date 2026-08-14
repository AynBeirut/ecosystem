import { describe, expect, it } from 'vitest';
import { checkSubscriptionAccess } from '@/lib/subscriptionGuard';
import type { StoreProfile } from '@/types/storeProfile';

describe('checkSubscriptionAccess', () => {
  it('allows access for the legacy owner email override even when blocked', () => {
    const profile = {
      email: 'mooveelectro@gmail.com',
      subscriptionStatus: 'blocked',
    } as StoreProfile;

    const access = checkSubscriptionAccess(profile);

    expect(access.allowed).toBe(true);
    expect(access.status).toBe('legacy');
  });

  it('treats grace_period as a grace-period access state', () => {
    const profile = {
      subscriptionStatus: 'grace_period',
      gracePeriodStartedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    } as StoreProfile;

    const access = checkSubscriptionAccess(profile);

    expect(access.allowed).toBe(true);
    expect(access.status).toBe('grace');
    expect(access.daysRemaining).toBeGreaterThan(0);
    expect(access.message).toContain('grace period');
  });

  it('allows access when a blocked profile still has a future subscription end date', () => {
    const profile = {
      subscriptionStatus: 'blocked',
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    } as StoreProfile;

    const access = checkSubscriptionAccess(profile);

    expect(access.allowed).toBe(true);
    expect(access.status).toBe('active');
  });
});
