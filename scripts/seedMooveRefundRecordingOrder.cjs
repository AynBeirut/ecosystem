/**
 * Pre-seed moove-only recording order: delivered + paid + simple-product stock deducted.
 * Touches ONLY store 1HfsBr45XYM5SkaaazWegmyqGpA3 and product 4Qo1xcOvRejSzJI4tDhw (solar).
 *
 * Usage: node scripts/seedMooveRefundRecordingOrder.cjs --write
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const MOOVE_STORE_ID = '1HfsBr45XYM5SkaaazWegmyqGpA3';
const SOLAR_PRODUCT_ID = '4Qo1xcOvRejSzJI4tDhw';
const INVOICE_NUMBER = 'INV-REC-001';
const ORDER_TOTAL = 10;
const QTY = 1;

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;
const buildKey = (kind, orderId, productId, meta = '') => [kind, orderId, productId, meta].join(':');

async function assertMooveOnly() {
  const productSnap = await db.collection('products').doc(SOLAR_PRODUCT_ID).get();
  if (!productSnap.exists) throw new Error('Solar product missing');
  if (productSnap.data().storeId !== MOOVE_STORE_ID) {
    throw new Error(`Solar product storeId mismatch: ${productSnap.data().storeId}`);
  }

  const existing = await db
    .collection('orders')
    .where('storeId', '==', MOOVE_STORE_ID)
    .where('invoiceNumber', '==', INVOICE_NUMBER)
    .limit(1)
    .get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    console.log(JSON.stringify({ alreadySeeded: true, orderId: doc.id, invoice: INVOICE_NUMBER }, null, 2));
    return doc.id;
  }
  return null;
}

async function verifySeed(orderId) {
  const orderSnap = await db.collection('orders').doc(orderId).get();
  const order = orderSnap.data();
  const productSnap = await db.collection('products').doc(SOLAR_PRODUCT_ID).get();
  const txs = productSnap.data().stockTransactions || [];
  const deliveredKey = txs.find((t) =>
    String(t.idempotencyKey || '').startsWith(`status-delivered:${orderId}:${SOLAR_PRODUCT_ID}:`),
  );
  const paidKey = txs.find((t) => t.idempotencyKey === `payment-paid:${orderId}:${SOLAR_PRODUCT_ID}`);

  return {
    orderId,
    invoiceNumber: order.invoiceNumber,
    storeId: order.storeId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    amountPaid: order.amountPaid,
    inventoryDeductedAt: order.inventoryDeductedAt || null,
    solarStock: productSnap.data().stock,
    solarInStock: productSnap.data().inStock,
    statusDeliveredKey: deliveredKey?.idempotencyKey || null,
    paymentPaidKey: paidKey?.idempotencyKey || null,
    note:
      'Manual admin path uses status-delivered for stock; payment-paid is online-checkout only (no double deduct).',
  };
}

async function seed() {
  const existingId = await assertMooveOnly();
  if (existingId) {
    console.log('\n=== VERIFY EXISTING ===\n');
    console.log(JSON.stringify(await verifySeed(existingId), null, 2));
    return;
  }

  const productRef = db.collection('products').doc(SOLAR_PRODUCT_ID);
  const orderRef = db.collection('orders').doc();
  const orderId = orderRef.id;
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];
  const paymentId = `AP-REC-${Date.now()}`;
  const deliveredKey = buildKey('status-delivered', orderId, SOLAR_PRODUCT_ID, 'line0:v1');

  let stockBefore;
  let stockAfter;

  await db.runTransaction(async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) throw new Error('Solar product missing in transaction');
    if (productSnap.data().storeId !== MOOVE_STORE_ID) {
      throw new Error('Abort: product not owned by moove store');
    }

    stockBefore = Number(productSnap.data().stock || 0);
    stockAfter = round3(Math.max(0, stockBefore - QTY));
    const transactions = Array.isArray(productSnap.data().stockTransactions)
      ? productSnap.data().stockTransactions
      : [];

    if (transactions.some((t) => t?.idempotencyKey === deliveredKey)) {
      throw new Error('Delivered idempotency key already exists on solar');
    }

    const stockTransaction = {
      id: `SIMPLE-STOCK-${Date.now()}-${SOLAR_PRODUCT_ID}`,
      date: nowIso,
      actionType: 'sold',
      quantity: -QTY,
      reason: `Sale from order ${INVOICE_NUMBER}`,
      referenceId: orderId,
      referenceNumber: INVOICE_NUMBER,
      userId: MOOVE_STORE_ID,
      userName: 'Recording seed',
      idempotencyKey: deliveredKey,
    };

    tx.set(orderRef, {
      storeId: MOOVE_STORE_ID,
      customerId: '',
      customerName: 'Recording Test Customer',
      customerPhone: '',
      customerEmail: '',
      invoiceNumber: INVOICE_NUMBER,
      invoiceNotes: 'Recording smoke test — moove only, safe to refund partial',
      items: [
        {
          productId: SOLAR_PRODUCT_ID,
          productName: productSnap.data().name || 'solar',
          quantity: QTY,
          discountType: 'percentage',
          discountValue: 0,
          price: ORDER_TOTAL,
        },
      ],
      subtotal: ORDER_TOTAL,
      taxType: 'none',
      taxRate: 0,
      taxAmount: 0,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: 0,
      total: ORDER_TOTAL,
      remainingAmount: 0,
      amountPaid: ORDER_TOTAL,
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      paymentDate: today,
      paymentNotes: 'Recording seed — full payment',
      paymentHistory: [
        {
          id: paymentId,
          amount: ORDER_TOTAL,
          entryType: 'payment',
          date: today,
          method: 'cash',
          notes: 'Recording seed payment',
          recordedBy: 'Recording seed',
          recordedAt: nowIso,
        },
      ],
      status: 'delivered',
      _stockDeliveryCount: 1,
      assignedSalesPerson: '',
      assignedSalesPersonName: '',
      createdAt: nowIso,
      createdBy: MOOVE_STORE_ID,
      updatedAt: nowIso,
    });

    tx.update(productRef, {
      stock: stockAfter,
      inStock: stockAfter > 0,
      stockTransactions: [...transactions, stockTransaction],
      updatedAt: nowIso,
    });
  });

  const verification = await verifySeed(orderId);
  console.log('\n=== SEEDED ===\n');
  console.log(
    JSON.stringify(
      {
        ...verification,
        stockBeforeRefund: stockBefore,
        stockAfterSeed: stockAfter,
        suggestedPartialRefund: 5,
        storesTouched: [MOOVE_STORE_ID],
        productsTouched: [SOLAR_PRODUCT_ID],
        ordersTouched: [orderId],
      },
      null,
      2,
    ),
  );
}

const write = process.argv.includes('--write');
if (!write) {
  console.log('Dry run. Pass --write to create moove-only INV-REC-001.');
  assertMooveOnly().then((id) => {
    if (id) verifySeed(id).then((v) => console.log(JSON.stringify(v, null, 2)));
  });
} else {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
