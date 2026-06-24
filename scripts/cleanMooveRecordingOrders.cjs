/**
 * Remove moove-only recording test orders INV-REC-001 / INV-REC-002
 * and restore solar stock deducted by those seeds.
 *
 * Usage: node scripts/cleanMooveRecordingOrders.cjs --write
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const MOOVE_STORE_ID = '1HfsBr45XYM5SkaaazWegmyqGpA3';
const SOLAR_PRODUCT_ID = '4Qo1xcOvRejSzJI4tDhw';
const TEST_INVOICES = ['INV-REC-001', 'INV-REC-002'];

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

function txBelongsToTestOrder(tx, orderIds) {
  const ref = String(tx?.referenceId || '');
  const inv = String(tx?.referenceNumber || '');
  const key = String(tx?.idempotencyKey || '');
  if (orderIds.has(ref)) return true;
  if (TEST_INVOICES.includes(inv)) return true;
  for (const id of orderIds) {
    if (key.includes(id)) return true;
  }
  return false;
}

async function main() {
  const write = process.argv.includes('--write');
  const orderSnaps = await db
    .collection('orders')
    .where('storeId', '==', MOOVE_STORE_ID)
    .where('invoiceNumber', 'in', TEST_INVOICES)
    .get();

  if (orderSnaps.empty) {
    console.log(JSON.stringify({ message: 'No test orders found — already clean' }, null, 2));
    return;
  }

  const orders = orderSnaps.docs.map((d) => ({ id: d.id, ...d.data() }));
  const bad = orders.filter((o) => o.storeId !== MOOVE_STORE_ID || !TEST_INVOICES.includes(o.invoiceNumber));
  if (bad.length) throw new Error('Safety check failed: unexpected order scope');

  const orderIds = new Set(orders.map((o) => o.id));
  const productRef = db.collection('products').doc(SOLAR_PRODUCT_ID);
  const productSnap = await productRef.get();
  if (!productSnap.exists || productSnap.data().storeId !== MOOVE_STORE_ID) {
    throw new Error('Solar product missing or not moove-owned');
  }

  const product = productSnap.data();
  const txs = Array.isArray(product.stockTransactions) ? product.stockTransactions : [];
  const removedTxs = txs.filter((tx) => txBelongsToTestOrder(tx, orderIds));
  const keptTxs = txs.filter((tx) => !txBelongsToTestOrder(tx, orderIds));
  const stockRestore = removedTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantity || 0)), 0);
  const stockBefore = Number(product.stock || 0);
  const stockAfter = round3(stockBefore + stockRestore);

  const plan = {
    mode: write ? 'write' : 'dry-run',
    storesTouched: [MOOVE_STORE_ID],
    productsTouched: [SOLAR_PRODUCT_ID],
    ordersToDelete: orders.map((o) => ({ id: o.id, invoice: o.invoiceNumber })),
    stockBefore,
    stockAfter,
    removedTransactionCount: removedTxs.length,
    removedTransactions: removedTxs.map((t) => ({
      idempotencyKey: t.idempotencyKey,
      referenceNumber: t.referenceNumber,
      quantity: t.quantity,
    })),
  };

  console.log(JSON.stringify(plan, null, 2));

  if (!write) {
    console.log('\nPass --write to apply.');
    return;
  }

  const batch = db.batch();
  for (const order of orders) {
    batch.delete(db.collection('orders').doc(order.id));
  }
  batch.update(productRef, {
    stock: stockAfter,
    inStock: stockAfter > 0,
    stockTransactions: keptTxs,
    updatedAt: new Date().toISOString(),
  });
  await batch.commit();

  console.log(
    JSON.stringify(
      {
        cleaned: true,
        ordersDeleted: orders.length,
        solarStock: stockAfter,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
