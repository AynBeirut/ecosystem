import { describe, expect, it } from 'vitest';
import {
  buildLebanonCnss190AFormFromGl,
  recalculateLebanonCnss190AForm,
  updateCnssBranchField,
} from '@/lib/ledger/lebanonCnss190AForm';
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

describe('lebanonCnss190AForm', () => {
  const accounts = [
    acct('w631', '631', 'expense', 'debit'),
    acct('e602', '602', 'expense', 'debit'),
    acct('p212', '212', 'liability', 'credit'),
  ];

  it('computes branch contributions and delay penalties per CNSS 190A formula', () => {
    const form = buildLebanonCnss190AFormFromGl(accounts, [], [], '2026-01-01', '2026-03-31');
    const withWages = recalculateLebanonCnss190AForm(
      updateCnssBranchField(
        updateCnssBranchField(
          updateCnssBranchField(form, 'sickness', 'wages', 100_000_000),
          'eos',
          'wages',
          100_000_000,
        ),
        'family',
        'wages',
        100_000_000,
      ),
    );

    expect(withWages.branches.find((b) => b.key === 'sickness')!.contributionsDue).toBe(9_000_000);
    expect(withWages.branches.find((b) => b.key === 'eos')!.contributionsDue).toBe(8_500_000);
    expect(withWages.branches.find((b) => b.key === 'family')!.contributionsDue).toBe(6_000_000);

    const withDelay = recalculateLebanonCnss190AForm(
      updateCnssBranchField(withWages, 'sickness', 'delayDays', 10),
    );
    expect(withDelay.branches.find((b) => b.key === 'sickness')!.delayDue).toBe(45_000);
    expect(withDelay.totalContributionsDue).toBe(23_545_000);
  });

  it('seeds wages and payable from GL period activity', () => {
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-02-15',
        memo: 'payroll',
        status: 'posted',
        sourceType: 'manual',
        sourceKey: 'manual:1',
        currency: 'LBP',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      {
        id: 'L1',
        storeId: 's1',
        entryId: 'JE-1',
        accountId: 'w631',
        accountCode: '631',
        accountName: 'Payroll',
        currency: 'LBP',
        debit: 50_000_000,
        credit: 0,
        lineOrder: 0,
      },
      {
        id: 'L2',
        storeId: 's1',
        entryId: 'JE-1',
        accountId: 'e602',
        accountCode: '602',
        accountName: 'CNSS',
        currency: 'LBP',
        debit: 11_750_000,
        credit: 0,
        lineOrder: 1,
      },
      {
        id: 'L3',
        storeId: 's1',
        entryId: 'JE-1',
        accountId: 'p212',
        accountCode: '212',
        accountName: 'CNSS Payable',
        currency: 'LBP',
        debit: 0,
        credit: 11_750_000,
        lineOrder: 2,
      },
    ];

    const form = buildLebanonCnss190AFormFromGl(accounts, entries, lines, '2026-01-01', '2026-03-31');
    expect(form.branches[0].wages).toBe(50_000_000);
    expect(form.branches[0].employeeCount).toBe(1);
    expect(form.totalContributionsDue).toBeGreaterThan(0);
  });
});
