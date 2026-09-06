import { describe, expect, it } from 'vitest';
import {
  resolveUsdToLbpFromCurrencySettings,
  resolveUsdToLbpFromProfile,
  resolveUsdToLbpRate,
  shouldFetchLiveUsdToLbpRate,
} from '@/lib/ledger/resolveExchangeRate';

describe('resolveExchangeRate', () => {
  it('reads Grabio profile customExchangeRate and legacy usdToLbpRate', () => {
    expect(resolveUsdToLbpFromProfile({ customExchangeRate: 89500 })).toBe(89500);
    expect(resolveUsdToLbpFromProfile({ customExchangeRate: 90000, usdToLbpRate: 89500 })).toBe(90000);
    expect(resolveUsdToLbpFromProfile({ usdToLbpRate: 88000 })).toBe(88000);
  });

  it('reads default USD→LBP pair from finance currency settings', () => {
    const rate = resolveUsdToLbpFromCurrencySettings([
      { from_currency: 'USD', to_currency: 'LBP', rate: 89000, is_default: false, effective_date: '2026-01-01' },
      { from_currency: 'USD', to_currency: 'LBP', rate: 89500, is_default: true, effective_date: '2026-08-01' },
    ]);
    expect(rate).toBe(89500);
  });

  it('prefers profile rate over currency settings', () => {
    const rate = resolveUsdToLbpRate(
      { customExchangeRate: 90000 },
      [{ from_currency: 'USD', to_currency: 'LBP', rate: 89500, is_default: true }],
    );
    expect(rate).toBe(90000);
  });

  it('auto-loads live rate when no manual or settings rate is saved', () => {
    expect(shouldFetchLiveUsdToLbpRate()).toBe(true);
    expect(shouldFetchLiveUsdToLbpRate(undefined)).toBe(true);
    expect(shouldFetchLiveUsdToLbpRate(89500)).toBe(false);
  });
});
