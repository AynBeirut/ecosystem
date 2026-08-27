import { describe, expect, it } from 'vitest';
import {
  formatSoaBalance,
  formatSoaDate,
  sayAccountCurrency,
  soaLineDescription,
  soaSectionTotals,
} from '@/lib/ledger/soaStatementView';

describe('soaStatementView', () => {
  it('formats dates as DD/MM/YYYY', () => {
    expect(formatSoaDate('2026-08-20')).toBe('20/08/2026');
  });

  it('suffixes running balance with Db or Cr', () => {
    expect(formatSoaBalance(2486.09, 'USD')).toBe('2,486.09 Db');
    expect(formatSoaBalance(-80, 'USD')).toBe('80.00 Cr');
  });

  it('builds AM-style description with type and serial', () => {
    expect(
      soaLineDescription({
        date: '2026-08-20',
        entryId: 'e1',
        memo: 'Sales Transaction',
        debit: 80,
        credit: 0,
        runningBalance: 2566.1,
        voucherType: 'RV',
        voucherNumber: '26004357',
      }).text,
    ).toBe('Sales Transaction RCV - 26004357');
  });

  it('includes B/F in debit/credit totals', () => {
    expect(
      soaSectionTotals({
        openingDebit: 2486.09,
        openingCredit: 0,
        rows: [
          { debit: 80.01, credit: 0 },
          { debit: 0, credit: 1427.04 },
        ],
      }),
    ).toEqual({ totalDebit: 2566.1, totalCredit: 1427.04 });
  });

  it('writes the Say Account Currency line', () => {
    expect(sayAccountCurrency(2891.15)).toBe(
      'Say Account Currency two thousand eight hundred ninety-one and 15 / 100 Only',
    );
  });
});
