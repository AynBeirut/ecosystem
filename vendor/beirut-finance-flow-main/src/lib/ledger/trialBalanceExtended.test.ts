import { describe, expect, it } from 'vitest';
import { buildExtendedTrialBalance, extendedTrialBalanceToCsv } from '@/lib/ledger/trialBalanceExtended';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const now = '2026-07-01T12:00:00.000Z';

function acct(id: string, code: string, opening = 0): LedgerAccount {
  return {
    id,
    storeId: 's1',
    code,
    name: code,
    type: 'asset',
    normalBalance: 'debit',
    isSystem: true,
    isActive: true,
    openingBalance: opening,
    createdAt: now,
    updatedAt: now,
  };
}

describe('buildExtendedTrialBalance', () => {
  const accounts = [
    { ...acct('a1', '5300', 0) },
    {
      ...acct('a2', '4010', 0),
      type: 'revenue' as const,
      normalBalance: 'credit' as const,
    },
  ];
  const entries: JournalEntry[] = [{ id: 'e1', storeId: 's1', date: '2026-01-15', status: 'posted', createdAt: now, updatedAt: now }];
  const lines: JournalLine[] = [
    { id: 'l1', storeId: 's1', entryId: 'e1', accountId: 'a1', debit: 50, credit: 0, createdAt: now, updatedAt: now },
    { id: 'l2', storeId: 's1', entryId: 'e1', accountId: 'a2', debit: 0, credit: 50, createdAt: now, updatedAt: now },
  ];

  it('builds balanced 6-column report', () => {
    const report = buildExtendedTrialBalance(accounts, entries, lines, {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      viewMode: '6col',
    });
    expect(report.viewMode).toBe('6col');
    expect(report.rows.length).toBeGreaterThanOrEqual(1);
    expect(report.balanced).toBe(true);
    expect(extendedTrialBalanceToCsv(report)).toContain('Open Dr');
  });
});
