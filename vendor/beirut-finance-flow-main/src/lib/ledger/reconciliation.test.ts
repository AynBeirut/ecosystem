import { describe, expect, it } from 'vitest';
import { buildReconciliationReport } from '@/lib/ledger/reconciliation';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const accounts: LedgerAccount[] = [
  {
    id: 'cash',
    storeId: 's1',
    code: '102',
    name: 'Cash',
    type: 'asset',
    normalBalance: 'debit',
    isActive: true,
    isSystem: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'bank-a',
    storeId: 's1',
    code: '5121',
    name: 'Bank USD',
    type: 'asset',
    normalBalance: 'debit',
    isActive: true,
    isSystem: false,
    grabioOperationalCode: '106',
    isPcgChart: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'bank-b',
    storeId: 's1',
    code: '5122',
    name: 'Bank LBP',
    type: 'asset',
    normalBalance: 'debit',
    isActive: true,
    isSystem: false,
    grabioOperationalCode: '105',
    isPcgChart: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'ap',
    storeId: 's1',
    code: '4011',
    name: 'Suppliers AP',
    type: 'liability',
    normalBalance: 'credit',
    isActive: true,
    isSystem: false,
    grabioOperationalCode: '201',
    isPcgChart: true,
    createdAt: '',
    updatedAt: '',
  },
];

const entries: JournalEntry[] = [
  {
    id: 'je1',
    storeId: 's1',
    date: '2026-08-01',
    memo: 'test',
    status: 'posted',
    sourceType: 'manual',
    sourceKey: 'manual-1',
    event: 'post',
    currency: 'USD',
    createdAt: '',
    updatedAt: '',
  },
];

const lines: JournalLine[] = [
  { id: 'l1', storeId: 's1', entryId: 'je1', accountId: 'cash', accountCode: '102', accountName: 'Cash', currency: 'USD', debit: 100, credit: 0 },
  { id: 'l2', storeId: 's1', entryId: 'je1', accountId: 'bank-a', accountCode: '5121', accountName: 'Bank USD', currency: 'USD', debit: 500, credit: 0 },
  { id: 'l3', storeId: 's1', entryId: 'je1', accountId: 'bank-b', accountCode: '5122', accountName: 'Bank LBP', currency: 'USD', debit: 200, credit: 0 },
  { id: 'l4', storeId: 's1', entryId: 'je1', accountId: 'ap', accountCode: '4011', accountName: 'AP', currency: 'USD', debit: 0, credit: 150 },
];

describe('buildReconciliationReport', () => {
  it('lists multiple bank accounts and compares bank total', () => {
    const report = buildReconciliationReport(accounts, entries, lines, '2026-08-18', {
      cashOnHand: 100,
      bankBalance: 700,
      deliveryHeldCash: 0,
      accountsReceivable: 0,
      accountsPayable: 150,
      arGlBalance: 0,
      apGlBalance: 150,
      supplierBalances: [{ name: 'Supplier X', amount: 150 }],
    });

    const bankRows = report.rows.filter((r) => r.group === 'bank' && !r.isTotal);
    expect(bankRows.length).toBe(2);
    const bankTotal = report.rows.find((r) => r.group === 'bank' && r.isTotal);
    expect(bankTotal?.glAmount).toBe(700);
    expect(bankTotal?.subledgerAmount).toBe(700);
    expect(bankTotal?.matched).toBe(true);
  });
});
