import { describe, expect, it } from 'vitest';
import { buildIncomeStatement } from '@/lib/ledger/incomeStatement';
import { formatLebanesePlAmount } from '@/lib/ledger/lebaneseProfitLoss';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

function account(partial: Partial<LedgerAccount> & Pick<LedgerAccount, 'id' | 'code' | 'type'>): LedgerAccount {
  return {
    name: partial.name || partial.code,
    normalBalance: partial.type === 'revenue' ? 'credit' : 'debit',
    isActive: true,
    isSystem: false,
    openingBalance: 0,
    storeId: 'store',
    ...partial,
  };
}

function entry(id: string, date: string): JournalEntry {
  return { id, date, status: 'posted', memo: id, storeId: 'store', createdAt: '', updatedAt: '' } as JournalEntry;
}

function line(id: string, entryId: string, accountId: string, debit: number, credit: number): JournalLine {
  return { id, entryId, accountId, debit, credit } as JournalLine;
}

describe('Lebanese P&L form', () => {
  it('formats losses in parentheses with 3 decimals', () => {
    expect(formatLebanesePlAmount(216299982.41)).toBe('216,299,982.410');
    expect(formatLebanesePlAmount(-3046382.763)).toBe('(3,046,382.763)');
  });

  it('Total COS = B.I + Purchases − E.I and Class 7 − COS = Gross Profit', () => {
    const accounts: LedgerAccount[] = [
      account({ id: 'sales', code: '401', type: 'revenue' }),
      account({ id: 'inv', code: '122', type: 'asset', openingBalance: 46601031.18 }),
      account({ id: 'purch', code: '502', type: 'expense' }),
      account({ id: 'ga', code: '610', type: 'expense' }),
      account({ id: 'sal', code: '601', type: 'expense' }),
    ];
    const entries = [
      entry('e1', '2026-08-10'),
      entry('e2', '2026-08-20'),
    ];
    const lines = [
      line('l1', 'e1', 'sales', 0, 216299982.41),
      line('l2', 'e1', 'purch', 229897829.16, 0),
      line('l3', 'e2', 'inv', 52700000, 0),
      line('l4', 'e1', 'ga', 25587702.53, 0),
      line('l5', 'e1', 'sal', 10917885.25, 0),
    ];

    const report = buildIncomeStatement(accounts, entries, lines, '2026-08-01', '2026-08-31');
    const form = report.lebaneseForm;

    expect(form.beginningInventory).toBe(46601031.18);
    expect(form.endingInventory).toBe(99301031.18);
    expect(form.purchasesGoods).toBe(229897829.16);
    expect(form.totalCos).toBe(177197829.16);
    expect(form.totalClass7).toBe(216299982.41);
    expect(form.grossProfit).toBe(39102153.25);
    expect(form.totalCos).toBe(
      Math.round((form.beginningInventory + form.purchasesGoods - form.endingInventory + Number.EPSILON) * 100) / 100,
    );
    expect(form.grossProfit).toBe(
      Math.round((form.totalClass7 - form.totalCos + Number.EPSILON) * 100) / 100,
    );
    expect(form.profitBeforeTax).toBe(
      Math.round((form.grossProfit - form.totalExpenses + Number.EPSILON) * 100) / 100,
    );
    expect(report.revenue.total).toBe(report.revenue.subtotal);
  });

  it('derives Purchases from perpetual COGS + inventory so COS identity holds', () => {
    const accounts: LedgerAccount[] = [
      account({ id: 'sales', code: '401', type: 'revenue' }),
      account({ id: 'inv', code: '120', type: 'asset', openingBalance: 1000 }),
      account({ id: 'cogs', code: '501', type: 'expense' }),
    ];
    const entries = [entry('e1', '2026-08-15')];
    const lines = [
      line('l1', 'e1', 'sales', 0, 5000),
      line('l2', 'e1', 'cogs', 800, 0),
      line('l3', 'e1', 'inv', 0, 800),
    ];

    const form = buildIncomeStatement(accounts, entries, lines, '2026-08-01', '2026-08-31').lebaneseForm;

    expect(form.beginningInventory).toBe(1000);
    expect(form.endingInventory).toBe(200);
    expect(form.purchasesGoods).toBe(0);
    expect(form.totalCos).toBe(800);
    expect(form.grossProfit).toBe(4200);
  });

  it('puts FX in Others, not Class 7', () => {
    const accounts: LedgerAccount[] = [
      account({ id: 'sales', code: '401', type: 'revenue' }),
      account({ id: 'fx', code: '450', type: 'revenue' }),
      account({ id: 'fxLoss', code: '704', type: 'expense' }),
    ];
    const entries = [entry('e1', '2026-08-12')];
    const lines = [
      line('l1', 'e1', 'sales', 0, 1000),
      line('l2', 'e1', 'fx', 0, 50),
      line('l3', 'e1', 'fxLoss', 80, 0),
    ];

    const form = buildIncomeStatement(accounts, entries, lines, '2026-08-01', '2026-08-31').lebaneseForm;
    expect(form.totalClass7).toBe(1000);
    expect(form.others).toBe(-30);
    expect(form.taxableProfit).toBe(form.profitBeforeTax + form.others);
  });
});
