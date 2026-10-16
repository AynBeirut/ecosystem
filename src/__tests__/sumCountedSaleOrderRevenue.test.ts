import { describe, expect, it } from 'vitest';
import {
  getOrderAmountDue,
  getOrderEffectiveAmountPaid,
  normalizeOrderPaymentStatus,
  sumCountedSaleOrderRevenue,
} from '@/lib/salesRules';

describe('sumCountedSaleOrderRevenue', () => {
  it('sums completed/delivered/paid and skips returned and negative credit lines', () => {
    const result = sumCountedSaleOrderRevenue([
      { status: 'completed', total: 100 },
      { status: 'delivered', total: 50 },
      { status: 'returned', total: 101.5 },
      { status: 'completed', total: -20 },
      { status: 'pending', total: 999 },
    ]);
    expect(result.revenue).toBe(150);
    expect(result.countedOrders).toBe(2);
    expect(result.excludedNonSaleStatus).toBe(2);
    expect(result.excludedInvalidOrNegativeTotal).toBe(1);
  });

  it('prevents Orders-page net-negative revenue regression', () => {
    const gross = sumCountedSaleOrderRevenue([
      { status: 'completed', total: 90487.16 },
      { status: 'completed', total: -628.64 },
    ]);
    expect(gross.revenue).toBe(90487.16);
    expect(gross.excludedInvalidOrNegativeTotal).toBe(1);
  });
});

describe('POS paid order display', () => {
  it('treats paymentStatus paid with zero amountPaid as fully paid', () => {
    const order = { paymentStatus: 'paid', amountPaid: 0, total: 66.5 };
    expect(normalizeOrderPaymentStatus(order)).toBe('paid');
    expect(getOrderEffectiveAmountPaid(order)).toBe(66.5);
    expect(getOrderAmountDue(order)).toBe(0);
  });
});
