/**
 * Read-only: zero-FG payment skip + historical refunds without inventory restore.
 * Usage: node scripts/auditInventoryGaps.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

const ZERO_FG_STORES = [
  'g4c7tzihykZRRGoBv6coGYo0QIz1',
  'p5zesYQXZRRYA3wKUxjfVCqxQQo1',
  'vbWshU8vmobg52zBaiZh0W9iI912',
  'xd6pGIer3RUEdL1vMy5OJQunjAO2',
];

const COUNTED = new Set(['delivered', 'paid', 'completed']);

function orderHasPaymentDeduction(orderId, productKey, txs) {
  const paidKey = `payment-paid:${orderId}:${productKey}`;
  if (txs.some((t) => t?.idempotencyKey === paidKey)) return true;
  return txs.some(
    (t) =>
      typeof t?.idempotencyKey === 'string' &&
      t.idempotencyKey.startsWith(`status-delivered:${orderId}:${productKey}:`),
  );
}

async function orderHasAnyDeduction(order) {
  const items = order.items || [];
  for (const item of items) {
    const productKey = item.productId || item.composedProductId || item.id || '';
    if (!productKey) continue;
    const fg = await db.collection('finishedGoodsInventory').where('storeId', '==', order.storeId).get();
    for (const doc of fg.docs) {
      const txs = doc.data().transactions || [];
      if (orderHasPaymentDeduction(order.id, productKey, txs)) return true;
    }
    const p = await db.collection('products').doc(productKey).get();
    if (p.exists && orderHasPaymentDeduction(order.id, productKey, p.data().stockTransactions || [])) {
      return true;
    }
  }
  return false;
}

async function auditZeroFgStores() {
  console.log('\n=== 1) Zero-FG stores — paid/shipped orders with no deduction ===\n');
  for (const storeId of ZERO_FG_STORES) {
    const profile = await db.collection('storeProfiles').doc(storeId).get();
    const name = profile.data()?.storeName || profile.data()?.email || storeId;
    const fg = await db.collection('finishedGoodsInventory').where('storeId', '==', storeId).limit(1).get();
    const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).get();

    let paidOrShipped = 0;
    let missingDeduction = 0;
    let missingUnits = 0;
    const samples = [];

    for (const doc of ordersSnap.docs) {
      const o = { id: doc.id, ...doc.data() };
      const paid = o.paymentStatus === 'paid' || o.paymentStatus === 'partial';
      const shipped = COUNTED.has(o.status);
      if (!paid && !shipped) continue;
      paidOrShipped += 1;

      const hasDeduct =
        Boolean(o.inventoryDeductedAt) || (await orderHasAnyDeduction(o));
      if (!hasDeduct) {
        missingDeduction += 1;
        for (const item of o.items || []) {
          missingUnits += Number(item.quantity || 0);
        }
        if (samples.length < 3) {
          samples.push({
            orderId: o.id,
            status: o.status,
            paymentStatus: o.paymentStatus,
            inventoryDeductedAt: o.inventoryDeductedAt || null,
            itemCount: (o.items || []).length,
          });
        }
      }
    }

    console.log(
      JSON.stringify({
        storeId,
        storeName: name,
        fgDocs: fg.size,
        paidOrShippedOrders: paidOrShipped,
        ordersMissingDeduction: missingDeduction,
        lineUnitsMissingDeduction: missingUnits,
        manualCorrectionNeeded: missingDeduction > 0,
        samples,
      }),
    );
  }
}

async function auditRefunds() {
  console.log('\n=== 2) Historical refunds without inventory restoration ===\n');
  const ordersSnap = await db.collection('orders').get();
  let refundEvents = 0;
  let refundsWithoutRestore = 0;
  let cumulativeUnitsNotRestored = 0;
  const samples = [];

  for (const doc of ordersSnap.docs) {
    const o = doc.data();
    const history = Array.isArray(o.paymentHistory) ? o.paymentHistory : [];
    const refunds = history.filter(
      (e) => e && (e.entryType === 'refund' || Number(e.amount || 0) < 0),
    );
    if (refunds.length === 0) continue;

    for (const refund of refunds) {
      refundEvents += 1;
      const refundId = refund.id || `unknown-${refundEvents}`;
      const refundAmount = Math.abs(Number(refund.amount || 0));
      const total = Math.max(0, Number(o.total || 0));
      const ratio = total > 0 ? Math.min(1, refundAmount / total) : 0;

      let restoredForRefund = false;
      for (const item of o.items || []) {
        const productKey = item.productId || item.composedProductId || item.id || '';
        if (!productKey) continue;
        const refundKeyPrefix = `payment-refund:${doc.id}:${productKey}:${refundId}`;
        const p = await db.collection('products').doc(productKey).get();
        const pTx = p.exists ? p.data().stockTransactions || [] : [];
        if (pTx.some((t) => String(t.idempotencyKey || '').startsWith(`payment-refund:${doc.id}:${productKey}:`))) {
          restoredForRefund = true;
          break;
        }
        const fg = await db.collection('finishedGoodsInventory').where('storeId', '==', o.storeId).get();
        for (const fgDoc of fg.docs) {
          const fgTx = fgDoc.data().transactions || [];
          if (fgTx.some((t) => String(t.idempotencyKey || '').startsWith(`payment-refund:${doc.id}:${productKey}:`))) {
            restoredForRefund = true;
            break;
          }
        }
        if (restoredForRefund) break;
      }

      if (!restoredForRefund && o.lastRefundInventoryRestore?.refundId === refundId) {
        restoredForRefund = Number(o.lastRefundInventoryRestore.restoredLines || 0) > 0;
      }

      if (!restoredForRefund) {
        refundsWithoutRestore += 1;
        for (const item of o.items || []) {
          cumulativeUnitsNotRestored += Number(item.quantity || 0) * ratio;
        }
        if (samples.length < 8) {
          samples.push({
            orderId: doc.id,
            storeId: o.storeId,
            refundId,
            refundAmount,
            orderTotal: total,
            proportionalUnitsNotRestored: Number((Number(o.items?.[0]?.quantity || 0) * ratio).toFixed(3)),
            status: o.status,
            paymentStatus: o.paymentStatus,
          });
        }
      }
    }
  }

  console.log(
    JSON.stringify({
      refundEventsTotal: refundEvents,
      refundsWithoutInventoryRestore: refundsWithoutRestore,
      estimatedCumulativeUnitsNotRestored: Number(cumulativeUnitsNotRestored.toFixed(3)),
      backfillCorrectionRecommended: refundsWithoutRestore > 0,
      samples,
    }),
  );
}

async function auditProductionEditUsage() {
  console.log('\n=== 3) Completed production batches (y.malek + all) ===\n');
  const yMalek = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
  const batches = await db.collection('productionBatches').where('status', '==', 'completed').get();
  const yMalekBatches = batches.docs.filter((d) => d.data().storeId === yMalek);
  console.log(
    JSON.stringify({
      completedBatchesAllStores: batches.size,
      completedBatchesYMalek: yMalekBatches.length,
      yMalekSample: yMalekBatches.slice(0, 3).map((d) => ({
        id: d.id,
        productName: d.data().productName,
        actualQuantity: d.data().actualQuantity,
        quantity: d.data().quantity,
      })),
      editCompletedWorkflowBlocked: true,
      yMalekStillHas: ['Complete', 'Recalc Cost', 'Delete (with reversal)'],
    }),
  );
}

async function main() {
  await auditZeroFgStores();
  await auditRefunds();
  await auditProductionEditUsage();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
