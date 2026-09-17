import { describe, expect, it } from 'vitest';
import {
  canCreateDemoEntity,
  demoDocumentNumber,
  isDemoSessionExpired,
  remainingDemoActions,
} from '@/lib/restaurantDemoLogic';

describe('restaurantDemoLogic', () => {
  it('allows creates only below max actions', () => {
    expect(canCreateDemoEntity(0)).toBe(true);
    expect(canCreateDemoEntity(4)).toBe(true);
    expect(canCreateDemoEntity(5)).toBe(false);
  });

  it('detects expiry', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isDemoSessionExpired(past)).toBe(true);
    expect(isDemoSessionExpired(future)).toBe(false);
  });

  it('prefixes demo document numbers', () => {
    expect(demoDocumentNumber('INV', 0)).toBe('DEMO-INV-001');
  });

  it('computes remaining actions', () => {
    expect(remainingDemoActions(3)).toBe(2);
    expect(remainingDemoActions(5)).toBe(0);
  });
});
