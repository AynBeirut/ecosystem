import { describe, expect, it } from 'vitest';
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

describe('buildVatFilingSummary', () => {
  const accounts = [
    acct('a220', VAT_ACCOUNT_CODES.OUTPUT, 'liability', 'credit'),
    acct('a140', VAT_ACCOUNT_CODES.INPUT, 'asset', 'debit'),
  ];

  it('sums period output VAT credits and net due', () => {
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-07-10',
        memo: 'sale',
        status: 'posted',
        sourceType: 'order',
        sourceKey: 'order:1:sale',
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'JE-2',
        storeId: 's1',
        date: '2026-06-15',
        memo: 'old',
        status: 'posted',
        sourceType: 'order',
        sourceKey: 'order:2:sale',
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      { id: 'L1', storeId: 's1', entryId: 'JE-1', accountId: 'a220', accountCode: '220', accountName: 'Out', currency: 'USD', debit: 0, credit: 11, lineOrder: 0 },
      { id: 'L2', storeId: 's1', entryId: 'JE-2', accountId: 'a220', accountCode: '220', accountName: 'Out', currency: 'USD', debit: 0, credit: 99, lineOrder: 0 },
    ];

    const report = buildVatFilingSummary(accounts, entries, lines, {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(report.outputVat.collected).toBe(11);
    expect(report.outputVat.net).toBe(11);
    expect(report.netVatDue).toBe(11);
    expect(report.bySource).toEqual([{ sourceType: 'order', outputNet: 11, inputNet: 0, entryCount: 1 }]);
  });

  it('subtracts input VAT from output for net due', () => {
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-07-05',
        memo: 'mix',
        status: 'posted',
        sourceType: 'purchase',
        sourceKey: 'purchase:1:post',
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      { id: 'L1', storeId: 's1', entryId: 'JE-1', accountId: 'a220', accountCode: '220', accountName: 'Out', currency: 'USD', debit: 0, credit: 11, lineOrder: 0 },
      { id: 'L2', storeId: 's1', entryId: 'JE-1', accountId: 'a140', accountCode: '140', accountName: 'In', currency: 'USD', debit: 5.5, credit: 0, lineOrder: 1 },
    ];

    const report = buildVatFilingSummary(accounts, entries, lines, {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(report.netVatDue).toBe(5.5);
  });
});
