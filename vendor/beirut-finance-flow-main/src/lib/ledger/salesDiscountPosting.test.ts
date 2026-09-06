import { describe, expect, it } from 'vitest';
import type { LedgerAccount } from '@/types/generalLedger';
import {
  appendSalesDiscountLines,
  applyRvSalesDiscount,
  resolveOrderSaleAmounts,
  resolveSaleDiscountAmount,
} from '@/lib/ledger/salesDiscountPosting';

const accounts: LedgerAccount[] = [
  {
    id: 'acct-1000',
    code: '102',
    name: 'Cash',
    type: 'asset',
    normalBalance: 'debit',
    isActive: true,
  },
  {
    id: 'acct-4000',
    code: '401',
    name: 'Sales',
    type: 'revenue',
    normalBalance: 'credit',
    isActive: true,
  },
  {
    id: 'acct-4100',
    code: '410',
    name: 'Discounts',
    type: 'revenue',
    normalBalance: 'debit',
    isActive: true,
  },
  {
    id: 'acct-7090',
    code: '7090',
    name: 'PCG Discount',
    type: 'expense',
    normalBalance: 'debit',
    isActive: true,
    isPcgChart: true,
    grabioOperationalCode: '410',
  },
];

describe('resolveSaleDiscountAmount', () => {
  it('returns fixed amount as-is', () => {
    expect(
      resolveSaleDiscountAmount({ discountType: 'fixed', discountValue: 10, netTotal: 90 }),
    ).toBe(10);
  });

  it('derives amount from percent of gross given net', () => {
    expect(
      resolveSaleDiscountAmount({ discountType: 'percentage', discountValue: 10, netTotal: 90 }),
    ).toBe(10);
  });

  it('falls back to legacy discountAmount', () => {
    expect(resolveSaleDiscountAmount({ discountAmount: 15 })).toBe(15);
  });
});

describe('resolveOrderSaleAmounts', () => {
  it('splits subtotal, discount, tax, and net', () => {
    const amounts = resolveOrderSaleAmounts({
      total: 99,
      subtotal: 100,
      discountAmount: 10,
      taxAmount: 9,
    });
    expect(amounts.grossRevenue).toBe(100);
    expect(amounts.discountAmount).toBe(10);
    expect(amounts.taxAmount).toBe(9);
    expect(amounts.netTotal).toBe(99);
  });
});

describe('appendSalesDiscountLines', () => {
  it('posts gross revenue and discount debit', () => {
    const lines = appendSalesDiscountLines(
      [
        { accountId: 'acct-1000', debit: 90, credit: 0, description: 'Cash' },
        { accountId: 'acct-4000', debit: 0, credit: 90, description: 'Sales' },
      ],
      { netTotal: 90, taxAmount: 0, discountAmount: 10, grossRevenue: 100 },
      accounts,
      'acct-4000',
    );
    const debits = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const credits = lines.reduce((s, l) => s + (l.credit || 0), 0);
    expect(debits).toBe(100);
    expect(credits).toBe(100);
    expect(lines.find((l) => l.accountId === 'acct-7090')?.debit).toBe(10);
    expect(lines.find((l) => l.accountId === 'acct-4000')?.credit).toBe(100);
  });
});

describe('applyRvSalesDiscount', () => {
  it('grosses up RV credit line from net + discount', () => {
    const lines = applyRvSalesDiscount(
      [
        { accountId: 'acct-1000', debit: 45, credit: 0, description: 'Cash' },
        { accountId: 'acct-4000', debit: 0, credit: 45, description: 'Sales' },
      ],
      5,
      accounts,
    );
    expect(lines.find((l) => l.accountId === 'acct-7090')?.debit).toBe(5);
    expect(lines.find((l) => l.accountId === 'acct-4000')?.credit).toBe(50);
  });
});
