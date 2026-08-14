import { describe, expect, it } from 'vitest';
import {
  accountCodeNumeric,
  accountsInCodeRange,
  isAccountInCodeRange,
  isChartClass17Code,
} from '@/lib/ledger/accountCodeRange';
import type { LedgerAccount } from '@/types/generalLedger';

const row = (code: string, active = true): LedgerAccount =>
  ({
    id: `acct-${code}`,
    storeId: 's1',
    code,
    name: `Account ${code}`,
    type: 'expense',
    normalBalance: 'debit',
    isActive: active,
  }) as LedgerAccount;

describe('accountCodeRange', () => {
  it('matches numeric ranges inclusive', () => {
    expect(isAccountInCodeRange('605', '601', '609')).toBe(true);
    expect(isAccountInCodeRange('610', '601', '609')).toBe(false);
    expect(isAccountInCodeRange('41115', '41110', '41130')).toBe(true);
  });

  it('swaps inverted from/to', () => {
    expect(isAccountInCodeRange('603', '609', '601')).toBe(true);
  });

  it('filters classes 1–7 only', () => {
    const accounts = [row('601'), row('801'), row('609')];
    const matched = accountsInCodeRange(accounts, '601', '809');
    expect(matched.map((a) => a.code)).toEqual(['601', '609']);
  });

  it('sorts by numeric code', () => {
    const accounts = [row('609'), row('601'), row('605')];
    const matched = accountsInCodeRange(accounts, '601', '609');
    expect(matched.map((a) => a.code)).toEqual(['601', '605', '609']);
  });

  it('recognizes chart class digits', () => {
    expect(isChartClass17Code('601')).toBe(true);
    expect(isChartClass17Code('801')).toBe(false);
    expect(accountCodeNumeric('41110')).toBe(41110);
  });

  it('matches prefix codes for short ranges', () => {
    expect(isAccountInCodeRange('6011', '601', '609')).toBe(true);
    expect(isAccountInCodeRange('6099', '601', '609')).toBe(true);
    expect(isAccountInCodeRange('6100', '601', '609')).toBe(false);
  });
});
