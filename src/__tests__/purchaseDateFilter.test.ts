import { describe, expect, it } from 'vitest';
import { purchaseMatchesPeriod } from '@/lib/purchaseDateFilter';

describe('purchaseMatchesPeriod', () => {
  const sep = { startDate: '2026-09-01', endDate: '2026-09-20' };

  it('custom range uses order date only, not import createdAt', () => {
    const purchase = {
      orderDate: '2026-08-22T12:00:00.000Z',
      createdAt: '2026-09-13T10:00:00.000Z',
    };
    expect(purchaseMatchesPeriod(purchase, sep)).toBe(false);
  });

  it('includes row when order date is in custom range', () => {
    expect(
      purchaseMatchesPeriod({ orderDate: '2026-09-10T00:00:00.000Z' }, sep),
    ).toBe(true);
  });

  it('today can still match createdAt for manual PO', () => {
    const today = { startDate: '2026-09-20', endDate: '2026-09-20' };
    expect(
      purchaseMatchesPeriod(
        { orderDate: '2026-03-01', createdAt: '2026-09-20T15:00:00.000Z' },
        today,
        { includeCreatedAtFallback: true },
      ),
    ).toBe(true);
  });
});
