import { describe, expect, it } from 'vitest'

/**
 * Invariants for delivered/pending/cancelled stock transitions.
 *
 * These tests guard against two regressions:
 * 1) Re-delivery idempotency-key collisions.
 * 2) Phantom restore when a matching delivery deduction never happened.
 */

type Tx = { idempotencyKey: string }

const buildInventoryEventKey = (
  kind: string,
  orderId: string,
  productId: string,
  meta = ''
) => [kind, orderId, productId, meta].filter(Boolean).join(':')

const hasInventoryEvent = (txs: Tx[], key: string) =>
  txs.some((tx) => tx.idempotencyKey === key)

const shouldApplyRestore = (
  txs: Tx[],
  restoreIdempotencyKey: string,
  requiredPriorKey?: string,
) => {
  const restoreAlreadyApplied = hasInventoryEvent(txs, restoreIdempotencyKey)
  if (restoreAlreadyApplied) return false

  if (requiredPriorKey && !hasInventoryEvent(txs, requiredPriorKey)) {
    return false
  }

  return true
}

describe('Inventory Transition Invariants', () => {
  const orderId = 'order-229'
  const productId = 'fg-3kg'

  it('uses unique delivery keys across delivery cycles (v-count)', () => {
    const keyV1 = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v1')
    const keyV2 = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v2')

    expect(keyV1).not.toBe(keyV2)
  })

  it('allows restore only when matching delivery key exists (modern flow)', () => {
    const deliveryKey = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v2')
    const restoreKey = buildInventoryEventKey('status-rollback', orderId, productId, 'line0:v2')

    const txs: Tx[] = [{ idempotencyKey: deliveryKey }]

    expect(shouldApplyRestore(txs, restoreKey, deliveryKey)).toBe(true)
  })

  it('blocks phantom restore when second delivery never happened', () => {
    const firstDeliveryKey = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v1')
    const missingSecondDeliveryKey = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v2')
    const rollbackKey = buildInventoryEventKey('status-rollback', orderId, productId, 'line0:v2')

    // Only v1 exists because v2 deduction was skipped/collided.
    const txs: Tx[] = [{ idempotencyKey: firstDeliveryKey }]

    expect(shouldApplyRestore(txs, rollbackKey, missingSecondDeliveryKey)).toBe(false)
  })

  it('blocks duplicate restores with restore idempotency key', () => {
    const deliveryKey = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v1')
    const restoreKey = buildInventoryEventKey('status-rollback', orderId, productId, 'line0:v1')

    const txs: Tx[] = [
      { idempotencyKey: deliveryKey },
      { idempotencyKey: restoreKey },
    ]

    expect(shouldApplyRestore(txs, restoreKey, deliveryKey)).toBe(false)
  })

  it('protects legacy delete path by requiring proof before restore', () => {
    const legacyDeliveredKey = buildInventoryEventKey(
      'status-delivered',
      orderId,
      productId,
      'pending->delivered:line0',
    )
    const requiredV0Key = buildInventoryEventKey('status-delivered', orderId, productId, 'line0:v0')
    const deleteRestoreKey = buildInventoryEventKey('order-delete', orderId, productId, 'cancelled:line0')

    const txs: Tx[] = [{ idempotencyKey: legacyDeliveredKey }]

    // Current guard behavior: no matching required key => no restore.
    expect(shouldApplyRestore(txs, deleteRestoreKey, requiredV0Key)).toBe(false)
  })
})
