import { describe, expect, it } from 'vitest';
import {
  convertLedgerAmount,
  defaultOperationalAccountRange,
  formatLedgerAmount,
  formatLedgerAmountForMode,
  splitOpeningByNormalBalance,
} from '@/lib/ledger/formatLedgerAmount';

describe('formatLedgerAmount', () => {
  it('labels LBP in full digits without compact K/M', () => {
    expect(formatLedgerAmount(89500000, 'LBP')).toBe('89,500,000 LBP');
    expect(formatLedgerAmount(89500000, 'LL')).toContain('LBP');
    expect(formatLedgerAmount(89500000, 'LBP')).not.toMatch(/[KM]/);
  });

  it('formats USD with $ and two decimals', () => {
    expect(formatLedgerAmount(1500.5, 'USD')).toBe('$1,500.50');
  });

  it('converts with usdToLbp rate and omits when missing', () => {
    expect(convertLedgerAmount(2, 'USD', 'LBP', 89500)).toBe(179000);
    expect(convertLedgerAmount(179000, 'LBP', 'USD', 89500)).toBe(2);
    expect(convertLedgerAmount(100, 'LBP', 'USD')).toBeNull();
  });

  it('splits opening net into Dr/Cr', () => {
    expect(splitOpeningByNormalBalance(50, 'debit')).toEqual({ debit: 50, credit: 0 });
    expect(splitOpeningByNormalBalance(-20, 'debit')).toEqual({ debit: 0, credit: 20 });
    expect(splitOpeningByNormalBalance(80, 'credit')).toEqual({ debit: 0, credit: 80 });
  });

  it('picks first/last active operational codes', () => {
    expect(
      defaultOperationalAccountRange([
        { code: '601', isActive: true },
        { code: '102', isActive: true },
        { code: '5300', isActive: true, isPcgChart: true },
      ]),
    ).toEqual({ fromCode: '102', toCode: '601' });
  });

  it('dual mode appends converted amount', () => {
    const text = formatLedgerAmountForMode(2, 'USD', 'both', 89500);
    expect(text).toContain('$2.00');
    expect(text).toContain('LBP');
  });
});
