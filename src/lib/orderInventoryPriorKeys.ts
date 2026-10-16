/** Idempotency keys for order ↔ inventory (admin + cloud checkout). */

export function buildInventoryEventKey(
  kind: string,
  orderId: string,
  productId: string,
  meta = '',
): string {
  return [kind, orderId, productId, meta].filter(Boolean).join(':');
}

type TxWithKey = { idempotencyKey?: string };

export function findOrderDeductionPriorKey(
  transactions: TxWithKey[],
  orderId: string,
  productKey: string,
): string | null {
  const paidKey = `payment-paid:${orderId}:${productKey}`;
  if (transactions.some((tx) => tx?.idempotencyKey === paidKey)) return paidKey;

  const deliveredKeys = transactions
    .map((tx) => tx?.idempotencyKey)
    .filter(
      (key): key is string =>
        typeof key === 'string' && key.startsWith(`status-delivered:${orderId}:${productKey}:`),
    );
  if (deliveredKeys.length > 0) {
    return deliveredKeys.sort().pop() ?? null;
  }

  return null;
}

/** FG / product rollback: payment-paid, versioned delivery, any delivery key, legacy admin path. */
export function findFgDeductionPriorKeyForRollback(
  transactions: TxWithKey[],
  orderId: string,
  productKey: string,
  lineIdx: number,
  deliveryCount: number,
): string | null {
  const fromProductStyle = findOrderDeductionPriorKey(transactions, orderId, productKey);
  if (fromProductStyle) return fromProductStyle;

  const versionedKey = buildInventoryEventKey(
    'status-delivered',
    orderId,
    productKey,
    `line${lineIdx}:v${deliveryCount}`,
  );
  if (transactions.some((tx) => tx?.idempotencyKey === versionedKey)) return versionedKey;

  const legacyKey = buildInventoryEventKey(
    'status-delivered',
    orderId,
    productKey,
    `pending->delivered:line${lineIdx}`,
  );
  if (transactions.some((tx) => tx?.idempotencyKey === legacyKey)) return legacyKey;

  return null;
}
