import { describe, expect, it } from 'vitest';
import {
  buildLebanonR10FormFromGl,
  recalculateLebanonR10Form,
  updateR10DualCell,
} from '@/lib/ledger/lebanonR10Form';
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

describe('lebanonR10Form', () => {
  const accounts = [
    acct('w631', '631', 'expense', 'debit'),
    acct('w213', '213', 'liability', 'credit'),
  ];

  it('recalculates chapter II totals and grand total due', () => {
    const form = buildLebanonR10FormFromGl(accounts, [], [], '2026-01-01', '2026-03-31');
    const next = recalculateLebanonR10Form(
      updateR10DualCell(updateR10DualCell(form, 100, 'board', 165_000_000), 100, 'employees', 60_000_000),
    );

    const r120 = next.chapterTwo.find((r) => r.code === 120)!;
    expect(r120.board).toBe(165_000_000);
    expect(r120.employees).toBe(60_000_000);

    const withDeductions = recalculateLebanonR10Form(
      updateR10DualCell(
        updateR10DualCell(
          updateR10DualCell(
            updateR10DualCell(
              updateR10DualCell(next, 110, 'employees', 27_000_000),
              130,
              'employees',
              27_000_000,
            ),
            140,
            'board',
            15_000_000,
          ),
          170,
          'board',
          112_500_000,
        ),
        170,
        'employees',
        60_000_000,
      ),
    );

    expect(withDeductions.chapterTwo.find((r) => r.code === 160)!.board).toBe(150_000_000);
    expect(withDeductions.chapterTwo.find((r) => r.code === 180)!.board).toBe(37_500_000);
    expect(withDeductions.totals.find((r) => r.code === 260)!.amount).toBe(37_500_000);
  });

  it('seeds wages and withholding from GL period activity', () => {
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
      {
        id: 'JE-2',
        storeId: 's1',
        date: '2026-04-01',
        memo: 'outside',
        status: 'posted',
        sourceType: 'manual',
        sourceKey: 'manual:2',
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
        debit: 60_000_000,
        credit: 0,
        lineOrder: 0,
      },
      {
        id: 'L2',
        storeId: 's1',
        entryId: 'JE-1',
        accountId: 'w213',
        accountCode: '213',
        accountName: 'R10',
        currency: 'LBP',
        debit: 0,
        credit: 750_000,
        lineOrder: 1,
      },
      {
        id: 'L3',
        storeId: 's1',
        entryId: 'JE-2',
        accountId: 'w631',
        accountCode: '631',
        accountName: 'Payroll',
        currency: 'LBP',
        debit: 99_000_000,
        credit: 0,
        lineOrder: 0,
      },
    ];

    const form = buildLebanonR10FormFromGl(accounts, entries, lines, '2026-01-01', '2026-03-31');
    expect(form.chapterTwo.find((r) => r.code === 100)!.employees).toBe(60_000_000);
    expect(form.chapterTwo.find((r) => r.code === 190)!.employees).toBe(750_000);
    expect(form.totals.find((r) => r.code === 270)!.amount).toBe(750_000);
  });
});
