import { describe, expect, it } from 'vitest';
import { createGlPresentationContext, presentGlEntry } from '@/lib/ledger/glEntryPresentation';
import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const now = '2026-07-01T12:00:00.000Z';

function acct(id: string, code: string, name: string, type: LedgerAccount['type']): LedgerAccount {
  return {
    id,
    storeId: 's1',
    code,
    name,
    type,
    normalBalance: type === 'asset' || type === 'expense' ? 'debit' : 'credit',
    isSystem: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

function entry(partial: Partial<JournalEntry>): JournalEntry {
  return {
    id: 'JE-1',
    storeId: 's1',
    date: '2026-03-15',
    memo: '',
    status: 'posted',
    sourceType: 'manual',
    sourceKey: 'manual:1',
    event: 'manual',
    currency: 'LBP',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function line(partial: Partial<JournalLine>): JournalLine {
  return {
    id: 'L1',
    storeId: 's1',
    entryId: 'JE-1',
    accountId: 'cash',
    accountCode: '5300',
    accountName: 'Cash',
    currency: 'LBP',
    debit: 0,
    credit: 0,
    lineOrder: 0,
    ...partial,
  };
}

describe('glEntryPresentation', () => {
  const accounts = [
    acct('cash', '5300', 'Cash On Hand', 'asset'),
    acct('rev', '701', 'Sales Revenue', 'revenue'),
    acct('exp', '610', 'Office Rent', 'expense'),
  ];

  const ctx = createGlPresentationContext(
    [{ id: 'po1', supplierName: 'Chaalan Plast', poNumber: 'PO-189', items: [{ description: 'Plastic cups' }] }],
    [{ id: 'pay1', supplierName: 'Chaalan Plast', purchaseOrderId: 'po1' }],
    [
      {
        id: 'ord1',
        invoiceNumber: 'INV-018',
        clientName: 'Mohammad Ismael',
        paymentMethod: 'cash',
        items: [{ description: 'Fajita box' }, { description: 'Soda' }],
      },
    ],
    [{ id: 'exp1', category: 'rent', name: 'Shop rent March' }],
    accounts,
  );

  it('formats POS sale with client, product category, and invoice ref', () => {
    const e = entry({
      id: 'JE-sale',
      sourceType: 'order',
      sourceId: 'ord1',
      voucherType: 'RV',
      voucherNumber: 'RV-2026-00001',
      memo: 'Order INV-018',
      event: 'sale-recognized',
    });
    const entryLines = [
      line({ entryId: 'JE-sale', accountId: 'cash', debit: 94000, lineOrder: 0 }),
      line({ entryId: 'JE-sale', accountId: 'rev', credit: 94000, lineOrder: 1 }),
    ];
    const p = presentGlEntry(e, entryLines[0], ctx, entryLines);
    expect(p.party).toBe('Mohammad Ismael');
    expect(p.category).toContain('Fajita');
    expect(p.reference).toContain('018');
  });

  it('formats purchase payment with supplier and PO category', () => {
    const e = entry({
      sourceType: 'purchase_payment',
      sourceId: 'pay1',
      memo: 'Purchase payment pay1 — (PO-189)',
      voucherType: 'PV',
    });
    const p = presentGlEntry(e, undefined, ctx);
    expect(p.party).toBe('Chaalan Plast');
    expect(p.category).toContain('Plastic');
    expect(p.reference).toBe('PO-189');
  });

  it('formats expense with vendor and expense category', () => {
    const e = entry({
      sourceType: 'expense',
      sourceId: 'exp1',
      memo: 'Expense exp1 — Shop rent March',
    });
    const entryLines = [
      line({ accountId: 'exp', debit: 5000000, lineOrder: 0 }),
      line({ accountId: 'cash', credit: 5000000, lineOrder: 1 }),
    ];
    const p = presentGlEntry(e, entryLines[1], ctx, entryLines);
    expect(p.party).toBe('Shop rent March');
    expect(p.category).toBe('Rent');
  });
});
