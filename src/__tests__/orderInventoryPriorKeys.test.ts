import { describe, expect, it } from 'vitest';
import {
  buildInventoryEventKey,
  findFgDeductionPriorKeyForRollback,
  findOrderDeductionPriorKey,
} from '@/lib/orderInventoryPriorKeys';

describe('orderInventoryPriorKeys', () => {
  const orderId = 'ord-1';
  const productKey = 'prod-a';

  it('finds payment-paid deduction from online checkout', () => {
    const paidKey = `payment-paid:${orderId}:${productKey}`;
    const prior = findOrderDeductionPriorKey([{ idempotencyKey: paidKey }], orderId, productKey);
    expect(prior).toBe(paidKey);
  });

  it('finds versioned status-delivered for rollback', () => {
    const deliveryKey = buildInventoryEventKey('status-delivered', orderId, productKey, 'line0:v1');
    const prior = findFgDeductionPriorKeyForRollback(
      [{ idempotencyKey: deliveryKey }],
      orderId,
      productKey,
      0,
      1,
    );
    expect(prior).toBe(deliveryKey);
  });

  it('finds legacy pending->delivered key', () => {
    const legacyKey = buildInventoryEventKey('status-delivered', orderId, productKey, 'pending->delivered:line0');
    const prior = findFgDeductionPriorKeyForRollback(
      [{ idempotencyKey: legacyKey }],
      orderId,
      productKey,
      0,
      0,
    );
    expect(prior).toBe(legacyKey);
  });
});
