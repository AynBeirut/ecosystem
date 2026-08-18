import { describe, expect, it } from 'vitest';
import { buildIncomeStatement } from '@/lib/ledger/incomeStatement';
import { buildLebanonVatReturnForm, recalculateLebanonVatForm, updateVatFormCell } from '@/lib/ledger/lebanonVatReturnForm';
import { buildVatFilingSummary, VAT_ACCOUNT_CODES } from '@/lib/ledger/vatFilingSummary';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const now = '2026-07-01T12:00:00.000Z';

function acct(id: string, code: string, type: LedgerAccount['type'], normal: 'debit' | 'credit'): LedgerAccount {
  return {
    id,
    storeId: 's1',
    code,
    name: code,
    type,
    normalBalance: normal,
    isSystem: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('buildLebanonVatReturnForm', () => {
  const accounts = [
    acct('a701', '701', 'revenue', 'credit'),
    acct('a601', '601', 'expense', 'debit'),
    acct('a220', VAT_ACCOUNT_CODES.OUTPUT, 'liability', 'credit'),
    acct('a140', VAT_ACCOUNT_CODES.INPUT, 'asset', 'debit'),
  ];

  it('maps revenue, purchases, and settlement lines from GL', () => {
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-07-10',
        memo: 'sale',
        status: 'posted',
        sourceType: 'order',
        sourceKey: 'order:1:sale',
        currency: 'LBP',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'JE-2',
        storeId: 's1',
        date: '2026-07-12',
        memo: 'purchase',
        status: 'posted',
        sourceType: 'purchase',
        sourceKey: 'purchase:1:post',
        currency: 'LBP',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      { id: 'L1', storeId: 's1', entryId: 'JE-1', accountId: 'a701', accountCode: '701', accountName: 'Rev', currency: 'LBP', debit: 0, credit: 100, lineOrder: 0 },
      { id: 'L2', storeId: 's1', entryId: 'JE-1', accountId: 'a220', accountCode: '220', accountName: 'Out', currency: 'LBP', debit: 0, credit: 11, lineOrder: 1 },
      { id: 'L3', storeId: 's1', entryId: 'JE-2', accountId: 'a601', accountCode: '601', accountName: 'COGS', currency: 'LBP', debit: 50, credit: 0, lineOrder: 0 },
      { id: 'L4', storeId: 's1', entryId: 'JE-2', accountId: 'a140', accountCode: '140', accountName: 'In', currency: 'LBP', debit: 5.5, credit: 0, lineOrder: 1 },
    ];

    const vatFiling = buildVatFilingSummary(accounts, entries, lines, {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });
    const incomeStatement = buildIncomeStatement(accounts, entries, lines, '2026-07-01', '2026-07-31');
    const form = buildLebanonVatReturnForm(vatFiling, incomeStatement);

    expect(form.revenues.find((r) => r.code === 100)?.col2).toBe(11);
    expect(form.revenues.find((r) => r.code === 190)?.col2).toBe(11);
    expect(form.purchases.find((r) => r.code === 200)?.col3).toBe(5.5);
    expect(form.purchases.find((r) => r.code === 250)?.col3).toBe(5.5);
    expect(form.settlement.find((r) => r.code === 340)?.col1).toBe(5.5);
  });

  it('recalculates totals when a detail cell changes', () => {
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-07-10',
        memo: 'sale',
        status: 'posted',
        sourceType: 'order',
        sourceKey: 'order:1:sale',
        currency: 'LBP',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      { id: 'L1', storeId: 's1', entryId: 'JE-1', accountId: 'a701', accountCode: '701', accountName: 'Rev', currency: 'LBP', debit: 0, credit: 100, lineOrder: 0 },
      { id: 'L2', storeId: 's1', entryId: 'JE-1', accountId: 'a220', accountCode: '220', accountName: 'Out', currency: 'LBP', debit: 0, credit: 11, lineOrder: 1 },
    ];
    const vatFiling = buildVatFilingSummary(accounts, entries, lines, { startDate: '2026-07-01', endDate: '2026-07-31' });
    const incomeStatement = buildIncomeStatement(accounts, entries, lines, '2026-07-01', '2026-07-31');
    const base = buildLebanonVatReturnForm(vatFiling, incomeStatement);
    const edited = recalculateLebanonVatForm(updateVatFormCell(base, 100, 'col2', 22));
    expect(edited.revenues.find((r) => r.code === 190)?.col2).toBe(22);
    expect(edited.settlement.find((r) => r.code === 300)?.col1).toBe(22);
  });
});
