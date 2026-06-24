/**
 * Live prod smoke: partial refund + restoreInventoryForRefund idempotency.
 * Mirrors AdminOrders.tsx logic (FG path).
 *
 * Usage:
 *   node scripts/smokeRefundRestore.cjs --dry-run
 *   node scripts/smokeRefundRestore.cjs --write --orderId=2LDvBpndTPfL2HLYSmlK --refundAmount=5.60
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

const args = process.argv.slice(2);
const dryRun = !args.includes('--write');
const orderIdArg = args.find((a) => a.startsWith('--orderId='));
const refundArg = args.find((a) => a.startsWith('--refundAmount='));
const ORDER_ID = orderIdArg ? orderIdArg.split('=')[1] : '2LDvBpndTPfL2HLYSmlK';
const REFUND_AMOUNT = refundArg ? Number(refundArg.split('=')[1]) : 5.6;

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;
const buildInventoryEventKey = (kind, orderId, productId, meta = '') =>
  [kind, orderId, productId, meta].join(':');

function resolveOrderItemProductKey(item) {
  return (item.productId || item.composedProductId || item.id || '').toString().trim();
}

function findMatchingFinishedGood(docs, orderItemProductId) {
  return docs.find((fgDoc) => {
    const data = fgDoc.data();
    return data.productId === orderItemProductId || data.composedProductId === orderItemProductId;
  });
}

function findOrderDeductionPriorKey(transactions, orderId, productKey) {
  const paidKey = `payment-paid:${orderId}:${productKey}`;
  if (transactions.some((tx) => tx?.idempotencyKey === paidKey)) return paidKey;
  const deliveredKeys = transactions
    .map((tx) => tx?.idempotencyKey)
    .filter(
      (key) => typeof key === 'string' && key.startsWith(`status-delivered:${orderId}:${productKey}:`),
    );
  if (deliveredKeys.length > 0) return deliveredKeys.sort().pop();
  return null;
}

async function snapshotOrder(orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new Error(`Order not found: ${orderId}`);
  return { ref: orderRef, id: orderSnap.id, ...orderSnap.data() };
}

async function snapshotFg(fgId) {
  const snap = await db.collection('finishedGoodsInventory').doc(fgId).get();
  if (!snap.exists) throw new Error(`FG not found: ${fgId}`);
  const data = snap.data();
  return {
    fgId,
    currentBalance: data.currentBalance,
    quantitySold: data.quantitySold,
    totalValue: data.totalValue,
    refundTxs: (data.transactions || []).filter((t) =>
      String(t.idempotencyKey || '').includes('payment-refund'),
    ),
  };
}

async function restoreInventoryForRefund(order, refundId, refundAmount, storeUser) {
  const totalAmount = Math.max(0, Number(order.total || 0));
  if (totalAmount <= 0 || refundAmount <= 0) return { restoredLines: 0, skippedLines: 0, writes: [] };

  const refundRatio = Math.min(1, refundAmount / totalAmount);
  const fgSnapshot = await db
    .collection('finishedGoodsInventory')
    .where('storeId', '==', order.storeId)
    .get();

  let restoredLines = 0;
  let skippedLines = 0;
  const writes = [];

  for (const item of order.items || []) {
    const productKey = resolveOrderItemProductKey(item);
    const lineQty = Number(item.quantity || 0);
    if (!productKey || lineQty <= 0) {
      skippedLines += 1;
      continue;
    }

    const restoreQty = round3(lineQty * refundRatio);
    if (restoreQty <= 0) {
      skippedLines += 1;
      continue;
    }

    const idempotencyKey = buildInventoryEventKey('payment-refund', order.id, productKey, refundId);
    const matchingFG = findMatchingFinishedGood(fgSnapshot.docs, productKey);

    if (matchingFG) {
      const fgData = matchingFG.data();
      const fgTx = fgData.transactions || [];
      const paidKey = `payment-paid:${order.id}:${productKey}`;
      const priorKey = fgTx.some((tx) => tx?.idempotencyKey === paidKey)
        ? paidKey
        : fgTx
            .map((tx) => tx?.idempotencyKey)
            .filter(
              (key) =>
                typeof key === 'string' &&
                key.startsWith(`status-delivered:${order.id}:${productKey}:`),
            )
            .sort()
            .pop() || null;

      if (!priorKey) {
        skippedLines += 1;
        continue;
      }

      const fgRef = db.collection('finishedGoodsInventory').doc(matchingFG.id);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(fgRef);
        if (!snap.exists) return;
        const data = snap.data();
        const txList = data.transactions || [];
        if (txList.some((t) => t?.idempotencyKey === idempotencyKey)) return;
        if (!txList.some((t) => t?.idempotencyKey === priorKey)) return;

        const cost = Number(data.costPrice || 0);
        const newBalance = round3(Number(data.currentBalance || 0) + restoreQty);
        const transaction = {
          id: `TXN-REFUND-${Date.now()}-${productKey}`,
          date: new Date().toISOString(),
          actionType: 'return',
          quantity: restoreQty,
          unitCost: cost,
          totalCost: round3(cost * restoreQty),
          reason: `Refund ${refundId}: Order ${order.invoiceNumber || order.id}`,
          referenceId: order.id,
          referenceNumber: order.invoiceNumber || order.id,
          userId: storeUser.id,
          userName: storeUser.name,
          idempotencyKey,
        };

        tx.update(fgRef, {
          currentBalance: newBalance,
          quantitySold: round3(Math.max(0, Number(data.quantitySold || 0) - restoreQty)),
          totalValue: round3(newBalance * cost),
          transactions: [...txList, transaction],
          updatedAt: new Date().toISOString(),
        });

        writes.push({
          collection: 'finishedGoodsInventory',
          docId: matchingFG.id,
          idempotencyKey,
          priorKey,
          restoreQty,
          balanceBefore: data.currentBalance,
          balanceAfter: newBalance,
          transaction,
        });
      });

      restoredLines += 1;
      continue;
    }

    const productRef = db.collection('products').doc(productKey);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      skippedLines += 1;
      continue;
    }

    const productData = productSnap.data();
    const priorKey = findOrderDeductionPriorKey(productData.stockTransactions || [], order.id, productKey);
    if (!priorKey) {
      skippedLines += 1;
      continue;
    }

    const idempotencyKeyProduct = buildInventoryEventKey('payment-refund', order.id, productKey, refundId);
    const transactions = productData.stockTransactions || [];
    if (transactions.some((t) => t?.idempotencyKey === idempotencyKeyProduct)) {
      restoredLines += 1;
      continue;
    }

    const currentStock = Number(productData.stock || 0);
    const newStock = currentStock + restoreQty;
    const stockTransaction = {
      id: `SIMPLE-STOCK-${Date.now()}-${productKey}`,
      date: new Date().toISOString(),
      actionType: 'return',
      quantity: restoreQty,
      reason: `Refund ${refundId}: Order ${order.invoiceNumber || order.id}`,
      referenceId: order.id,
      referenceNumber: order.invoiceNumber || order.id,
      userId: storeUser.id,
      userName: storeUser.name,
      idempotencyKey: idempotencyKeyProduct,
    };

    await productRef.update({
      stock: newStock,
      inStock: newStock > 0,
      stockTransactions: [...transactions, stockTransaction],
      updatedAt: new Date().toISOString(),
    });

    writes.push({
      collection: 'products',
      docId: productKey,
      idempotencyKey: idempotencyKeyProduct,
      priorKey,
      restoreQty,
      stockBefore: currentStock,
      stockAfter: newStock,
      transaction: stockTransaction,
    });
    restoredLines += 1;
  }

  return { restoredLines, skippedLines, writes };
}

async function main() {
  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'write', ORDER_ID, REFUND_AMOUNT }, null, 2));

  const order = await snapshotOrder(ORDER_ID);
  const total = Number(order.total || 0);
  const paid = Number(order.amountPaid || 0);
  if (paid <= 0) throw new Error('Order has no paid balance');
  if (REFUND_AMOUNT > paid + 0.0001) throw new Error(`Refund ${REFUND_AMOUNT} exceeds paid ${paid}`);

  const item = (order.items || [])[0];
  const productKey = resolveOrderItemProductKey(item);
  const fgSnap = await db
    .collection('finishedGoodsInventory')
    .where('storeId', '==', order.storeId)
    .get();
  const matchingFG = findMatchingFinishedGood(fgSnap.docs, productKey);
  const fgBefore = matchingFG ? await snapshotFg(matchingFG.id) : null;

  const before = {
    orderId: ORDER_ID,
    invoice: order.invoiceNumber,
    storeId: order.storeId,
    total,
    amountPaid: paid,
    paymentStatus: order.paymentStatus,
    inventoryDeductedAt: order.inventoryDeductedAt || null,
    productKey,
    lineQty: item?.quantity,
    fgBefore,
    expectedRestoreQty: round3(Number(item?.quantity || 0) * Math.min(1, REFUND_AMOUNT / total)),
    expectedIdempotencyKey: buildInventoryEventKey('payment-refund', ORDER_ID, productKey, `RFD-SMOKE-${Date.now()}`),
  };
  console.log('\n=== BEFORE ===\n');
  console.log(JSON.stringify(before, null, 2));

  if (dryRun) {
    console.log('\nPass --write to apply refund + inventory restore.');
    return;
  }

  const refundId = `RFD-SMOKE-${Date.now()}`;
  const storeUser = { id: order.storeId, name: 'smoke-refund-script' };
  const newAmountPaid = Math.max(0, Math.round((paid - REFUND_AMOUNT) * 100) / 100);
  let paymentStatus = 'unpaid';
  if (newAmountPaid >= total && total > 0) paymentStatus = 'paid';
  else if (newAmountPaid > 0) paymentStatus = 'partial';
  else if (REFUND_AMOUNT > 0 && paid > 0) paymentStatus = 'refunded';

  const refundRecord = {
    id: refundId,
    amount: -REFUND_AMOUNT,
    entryType: 'refund',
    date: new Date().toISOString().split('T')[0],
    method: 'cash',
    notes: 'Prod smoke test — partial refund inventory restore',
    recordedBy: 'smoke-refund-script',
    recordedAt: new Date().toISOString(),
  };

  const inventoryRestore = await restoreInventoryForRefund(order, refundId, REFUND_AMOUNT, storeUser);

  await order.ref.update({
    paymentStatus,
    amountPaid: newAmountPaid,
    remainingAmount: Math.max(0, Math.round((total - newAmountPaid) * 100) / 100),
    paymentHistory: [...(order.paymentHistory || []), refundRecord],
    lastRefundInventoryRestore: {
      refundId,
      refundAmount: REFUND_AMOUNT,
      restoredLines: inventoryRestore.restoredLines,
      skippedLines: inventoryRestore.skippedLines,
      restoredAt: new Date().toISOString(),
    },
  });

  const orderAfter = await snapshotOrder(ORDER_ID);
  const fgAfter = matchingFG ? await snapshotFg(matchingFG.id) : null;

  console.log('\n=== AFTER ===\n');
  console.log(
    JSON.stringify(
      {
        refundId,
        idempotencyKey: buildInventoryEventKey('payment-refund', ORDER_ID, productKey, refundId),
        inventoryRestore,
        orderAfter: {
          paymentStatus: orderAfter.paymentStatus,
          amountPaid: orderAfter.amountPaid,
          remainingAmount: orderAfter.remainingAmount,
          inventoryDeductedAt: orderAfter.inventoryDeductedAt || null,
          lastRefundInventoryRestore: orderAfter.lastRefundInventoryRestore,
          refundHistoryEntry: (orderAfter.paymentHistory || []).slice(-1)[0],
        },
        fgAfter,
        delta: fgBefore && fgAfter
          ? {
              currentBalance: round3(fgAfter.currentBalance - fgBefore.currentBalance),
              quantitySold: round3(fgAfter.quantitySold - fgBefore.quantitySold),
            }
          : null,
        inventoryWrite: inventoryRestore.writes[0] || null,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
