import { describe, expect, it } from 'vitest';
import { checkSubscriptionAccess } from '@/lib/subscriptionGuard';
import type { StoreProfile } from '@/types/storeProfile';

describe('checkSubscriptionAccess legacy users', () => {
  it('allows legacy users even when the subscription state is blocked and no legacy expiry is set', () => {
    const profile = {
      isLegacyUser: true,
      subscriptionStatus: 'blocked',
    } as StoreProfile;

    const access = checkSubscriptionAccess(profile);

    expect(access.allowed).toBe(true);
    expect(access.status).toBe('legacy');
  });
});
