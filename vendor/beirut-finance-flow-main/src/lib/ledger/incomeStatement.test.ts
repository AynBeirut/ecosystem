import { describe, expect, it } from 'vitest';
import { buildIncomeStatement } from '@/lib/ledger/incomeStatement';
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

describe('buildIncomeStatement', () => {
  it('uses period journal activity only (not opening balances)', () => {
    const accounts: LedgerAccount[] = [
      account({ id: 'rev', code: '401', type: 'revenue', openingBalance: 5000 }),
      account({ id: 'exp', code: '502', type: 'expense', openingBalance: 2000 }),
    ];
    const entries: JournalEntry[] = [
      { id: 'e1', date: '2026-08-10', status: 'posted', memo: 'sale', storeId: 'store', createdAt: '', updatedAt: '' },
      { id: 'e2', date: '2026-08-11', status: 'posted', memo: 'cogs', storeId: 'store', createdAt: '', updatedAt: '' },
    ];
    const lines: JournalLine[] = [
      { id: 'l1', entryId: 'e1', accountId: 'rev', debit: 0, credit: 1000 },
      { id: 'l2', entryId: 'e2', accountId: 'exp', debit: 400, credit: 0 },
    ];

    const report = buildIncomeStatement(accounts, entries, lines, '2026-08-01', '2026-08-31');

    expect(report.totalRevenue).toBe(1000);
    expect(report.cogs.subtotal).toBe(400);
    expect(report.grossProfit).toBe(600);
    expect(report.netIncome).toBe(600);
  });

  it('classifies Lebanese PCG revenue and expense codes', () => {
    const accounts: LedgerAccount[] = [
      account({ id: 'rev', code: '7011', type: 'revenue' }),
      account({ id: 'cogs', code: '6011', type: 'expense' }),
      account({ id: 'opex', code: '6311', type: 'expense' }),
    ];
    const entries: JournalEntry[] = [
      { id: 'e1', date: '2026-08-05', status: 'posted', memo: 'sale', storeId: 'store', createdAt: '', updatedAt: '' },
    ];
    const lines: JournalLine[] = [
      { id: 'l1', entryId: 'e1', accountId: 'rev', debit: 0, credit: 2500 },
      { id: 'l2', entryId: 'e1', accountId: 'cogs', debit: 900, credit: 0 },
      { id: 'l3', entryId: 'e1', accountId: 'opex', debit: 300, credit: 0 },
    ];

    const report = buildIncomeStatement(accounts, entries, lines, '2026-08-01', '2026-08-31');

    expect(report.revenue.subtotal).toBe(2500);
    expect(report.cogs.subtotal).toBe(900);
    expect(report.operatingExpenses.subtotal).toBe(300);
    expect(report.grossProfit).toBe(1600);
    expect(report.operatingIncome).toBe(1300);
    expect(report.netIncome).toBe(1300);
  });

  it('includes Lebanese PCG chart detail accounts used for posting', () => {
    const accounts: LedgerAccount[] = [
      account({ id: 'rev', code: '7010', type: 'revenue', isPcgChart: true, pcgKind: 'D' }),
      account({ id: 'cogs', code: '6011', type: 'expense', isPcgChart: true, pcgKind: 'D' }),
    ];
    const entries: JournalEntry[] = [
      { id: 'e1', date: '2026-08-05', status: 'posted', memo: 'sale', storeId: 'store', createdAt: '', updatedAt: '' },
    ];
    const lines: JournalLine[] = [
      { id: 'l1', entryId: 'e1', accountId: 'rev', debit: 0, credit: 800 },
      { id: 'l2', entryId: 'e1', accountId: 'cogs', debit: 300, credit: 0 },
    ];

    const report = buildIncomeStatement(accounts, entries, lines, '2026-08-01', '2026-08-31');

    expect(report.totalRevenue).toBe(800);
    expect(report.netIncome).toBe(500);
  });
});
