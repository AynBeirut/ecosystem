import { describe, expect, it } from 'vitest';
import {
  resolvePurchaseAmountPaid,
  resolvePurchasePaymentStatus,
} from '@/lib/purchasePaymentStatement';
import type { Purchase } from '@/types/inventory';

describe('purchasePaymentStatement', () => {
  it('reads POS paidAmount for supplier statement balance', () => {
    const purchase = {
      totalAmount: 100,
      paidAmount: 100,
      paymentStatus: 'unpaid',
    } as Purchase & { paidAmount: number };
    expect(resolvePurchaseAmountPaid(purchase)).toBe(100);
    expect(resolvePurchasePaymentStatus(purchase)).toBe('paid');
  });

  it('treats explicit paid status as full total when amount missing', () => {
    const purchase = {
      totalAmount: 72.64,
      paymentStatus: 'paid',
      amountPaid: 0,
    } as Purchase;
    expect(resolvePurchaseAmountPaid(purchase)).toBe(72.64);
  });
});
