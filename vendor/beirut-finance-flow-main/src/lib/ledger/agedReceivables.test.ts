import { describe, expect, it } from 'vitest';
import { buildAgedReceivablesReport, invoiceOutstandingBalance } from '@/lib/ledger/agedReceivables';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const now = '2026-07-01T12:00:00.000Z';

function acct(id: string, code: string): LedgerAccount {
  return {
    id,
    storeId: 's1',
    code,
    name: code,
    type: 'asset',
    normalBalance: 'debit',
    isSystem: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('buildAgedReceivablesReport', () => {
  it('buckets outstanding by invoice age', () => {
    const invoices = [
      { id: 'INV-1', date: '2026-07-20', clientName: 'A', status: 'sent', amount: 100 },
      { id: 'INV-2', date: '2026-05-01', clientName: 'B', status: 'partial', amount: 200, paidAmount: 50 },
      { id: 'INV-3', date: '2026-07-01', clientName: 'C', status: 'paid', amount: 999 },
    ];
    const report = buildAgedReceivablesReport(invoices, [], [], [], '2026-07-25');
    expect(report.buckets.current).toBe(100);
    expect(report.buckets.days31_60).toBe(0);
    expect(report.buckets.days61_90).toBe(150);
    expect(report.subledgerTotal).toBe(250);
    expect(report.openInvoiceCount).toBe(2);
  });

  it('matches GL 110 balance', () => {
    const accounts = [acct('a110', '110')];
    const entries: JournalEntry[] = [
      {
        id: 'JE-1',
        storeId: 's1',
        date: '2026-07-01',
        memo: 'sale',
        status: 'posted',
        sourceType: 'invoice',
        sourceKey: 'invoice:1:sale',
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const lines: JournalLine[] = [
      {
        id: 'L1',
        storeId: 's1',
        entryId: 'JE-1',
        accountId: 'a110',
        accountCode: '110',
        accountName: 'AR',
        currency: 'USD',
        debit: 250,
        credit: 0,
        lineOrder: 0,
      },
    ];
    const invoices = [{ id: 'INV-1', date: '2026-07-01', clientName: 'X', status: 'sent', amount: 250 }];
    const report = buildAgedReceivablesReport(invoices, accounts, entries, lines, '2026-07-25');
    expect(report.glBalance).toBe(250);
    expect(report.matched).toBe(true);
  });
});

describe('invoiceOutstandingBalance', () => {
  it('respects partial payments', () => {
    expect(
      invoiceOutstandingBalance({ id: '1', date: '2026-01-01', clientName: 'a', status: 'partial', amount: 100, paidAmount: 40 }),
    ).toBe(60);
  });
});
