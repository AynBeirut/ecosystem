import { describe, expect, it } from 'vitest';
import { purchaseOrderOutstandingBalance } from '@/lib/ledger/agedPayables';

describe('purchaseOrderOutstandingBalance', () => {
  it('includes fulfilled platform purchases when unpaid', () => {
    const out = purchaseOrderOutstandingBalance(
      {
        id: 'P1',
        date: '2026-01-01',
        supplierName: 'Vendor',
        status: 'fulfilled',
        amount: 1000,
        total: 1000,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        source: 'platform',
      },
      [],
    );
    expect(out).toBe(1000);
  });

  it('excludes fulfilled finance PO when fully paid', () => {
    const out = purchaseOrderOutstandingBalance(
      {
        id: 'PO-1',
        date: '2026-01-01',
        supplierName: 'Vendor',
        status: 'fulfilled',
        amount: 500,
        total: 500,
        paidAmount: 500,
        source: 'finance',
      },
      [],
    );
    expect(out).toBe(0);
  });

  it('honors partial payment on platform purchase', () => {
    const out = purchaseOrderOutstandingBalance(
      {
        id: 'P2',
        date: '2026-01-01',
        supplierName: 'Vendor',
        status: 'fulfilled',
        amount: 1000,
        total: 1000,
        paidAmount: 400,
        paymentStatus: 'partial',
        source: 'platform',
      },
      [],
    );
    expect(out).toBe(600);
  });

  it('excludes draft purchases even when marked unpaid', () => {
    const out = purchaseOrderOutstandingBalance(
      {
        id: 'DRAFT-1',
        date: '2026-01-01',
        supplierName: 'Vendor',
        status: 'draft',
        amount: 32.76,
        total: 32.76,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        source: 'platform',
      },
      [],
    );
    expect(out).toBe(0);
  });
});
