import { describe, expect, it } from 'vitest';
import { buildCashFlowStatement } from '@/lib/ledger/cashFlowStatement';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const now = '2026-07-01T12:00:00.000Z';

function acct(
  id: string,
  code: string,
  type: LedgerAccount['type'],
  normal: 'debit' | 'credit',
): LedgerAccount {
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

describe('buildCashFlowStatement', () => {
  const accounts = [
    acct('a102', '102', 'asset', 'debit'),
    acct('a401', '401', 'revenue', 'credit'),
    acct('a220', '220', 'liability', 'credit'),
  ];

  it('reconciles when sales split revenue and output VAT (220)', () => {
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-07-15',
        memo: 'sale with VAT',
        status: 'posted',
        sourceType: 'order',
        sourceKey: 'order:1',
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      { id: 'L1', storeId: 's1', entryId: 'JE-1', accountId: 'a102', accountCode: '102', accountName: 'Cash', currency: 'USD', debit: 11, credit: 0, lineOrder: 0 },
      { id: 'L2', storeId: 's1', entryId: 'JE-1', accountId: 'a401', accountCode: '401', accountName: 'Rev', currency: 'USD', debit: 0, credit: 10, lineOrder: 1 },
      { id: 'L3', storeId: 's1', entryId: 'JE-1', accountId: 'a220', accountCode: '220', accountName: 'VAT', currency: 'USD', debit: 0, credit: 1, lineOrder: 2 },
    ];

    const report = buildCashFlowStatement(accounts, entries, lines, {
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(report.netIncome).toBe(10);
    expect(report.cashDeltaFromAccounts).toBe(11);
    expect(report.reconciliationVariance).toBe(0);
    expect(report.reconciled).toBe(true);
  });
});
