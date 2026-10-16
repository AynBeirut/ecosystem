import { describe, expect, it } from 'vitest';
import { resolvePurchaseStatementDate, statementAmountBuckets } from '@/lib/partyOperationalStatement';

describe('resolvePurchaseStatementDate', () => {
  it('uses orderDate not createdAt for cash-book purchases', () => {
    const date = resolvePurchaseStatementDate({
      orderDate: '2026-03-20T12:00:00.000Z',
      createdAt: '2026-09-13T10:15:37.833Z',
      receivedDate: '2026-03-20T12:00:00.000Z',
    });
    expect(date).toBe('2026-03-20');
  });

  it('keeps USD and LBP line amounts apart', () => {
    const buckets = statementAmountBuckets({
      currency: 'USD',
      items: [
        { currency: 'USD', quantity: 1, unitPrice: 10, subtotal: 10 },
        { currency: 'LBP', quantity: 2, unitPrice: 50000, subtotal: 100000 },
      ],
    }, 100010);
    expect(buckets).toEqual([
      { currency: 'USD', amount: 10 },
      { currency: 'LBP', amount: 100000 },
    ]);
  });
});
