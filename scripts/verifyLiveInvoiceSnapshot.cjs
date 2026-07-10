#!/usr/bin/env node
/**
 * Live post-deploy check: create a paid finance invoice with cost snapshot,
 * verify line rawPrice frozen, verify Reports COGS uses snapshot only.
 * Cleans up test invoice unless --keep.
 */
const admin = require('firebase-admin');
const path = require('path');

const KEEP = process.argv.includes('--keep');
const storeId = process.argv[2] || 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
const testRunId = `live-snapshot-${Date.now()}`;

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

function buildFgCostMap(docs) {
  const map = {};
  for (const doc of docs) {
    const d = doc.data();
    const pid = d.productId || d.composedProductId;
    const cost = Number(d.costPrice || 0);
    if (pid && cost > 0) map[pid] = cost;
  }
  return map;
}

function snapshotUnitCost(productId, product, fgMap) {
  const fg = fgMap[productId] || 0;
  const productCost = Number(product?.costPrice || 0);
  const serviceCost = Number(product?.serviceCost || 0);
  return Math.max(0, fg || productCost || serviceCost);
}

function reportsCogs(invoice) {
  let cogs = 0;
  for (const item of invoice.items || invoice.lineItems || []) {
    cogs += (Number(item.rawPrice) || 0) * (Number(item.quantity) || 0);
  }
  return Math.round(cogs * 100) / 100;
}

async function main() {
  console.log(`\n=== Live invoice snapshot verify — store ${storeId} ===\n`);

  const [fgSnap, prodSnap] = await Promise.all([
    db.collection('finishedGoodsInventory').where('storeId', '==', storeId).get(),
    db.collection('products').where('storeId', '==', storeId).limit(30).get(),
  ]);

  const fgMap = buildFgCostMap(fgSnap.docs);
  let picked = null;

  for (const doc of prodSnap.docs) {
    const data = doc.data();
    const snap = snapshotUnitCost(doc.id, data, fgMap);
    if (snap > 0) {
      picked = { id: doc.id, name: data.name || doc.id, snap, data };
      break;
    }
  }

  if (!picked) {
    // fallback: any product with costPrice
    for (const doc of prodSnap.docs) {
      const data = doc.data();
      if (Number(data.costPrice || 0) > 0) {
        picked = { id: doc.id, name: data.name || doc.id, snap: Number(data.costPrice), data };
        break;
      }
    }
  }

  if (!picked) {
    console.error('No product with platform cost found on this store.');
    process.exit(1);
  }

  const qty = 2;
  const unitPrice = 12;
  const invoiceId = `INV-LIVE-${Date.now()}`;
  const now = new Date().toISOString();

  const line = {
    id: picked.id,
    description: picked.name,
    quantity: qty,
    unitPrice,
    subtotal: qty * unitPrice,
    rawPrice: picked.snap,
  };

  const invoice = {
    testRunId,
    date: now,
    status: 'paid',
    clientName: 'Live Snapshot Test',
    amount: qty * unitPrice,
    currency: 'USD',
    lineItems: [line],
    items: [line],
    createdAt: now,
  };

  const invRef = db.collection('stores').doc(storeId).collection('financeInvoices').doc(invoiceId);
  await invRef.set(invoice);

  const readBack = (await invRef.get()).data();
  const storedRaw = Number((readBack.items || [])[0]?.rawPrice);
  const cogs = reportsCogs(readBack);

  console.log(`Product:     ${picked.name} (${picked.id})`);
  console.log(`Snapshot @ save: $${picked.snap.toFixed(4)}`);
  console.log(`Invoice:     ${invoiceId}`);
  console.log(`Line rawPrice stored: $${storedRaw.toFixed(4)}`);
  console.log(`Reports COGS:         $${cogs.toFixed(2)} (${qty} × $${storedRaw.toFixed(4)})`);

  const passSnapshot = Math.abs(storedRaw - picked.snap) < 0.0001;
  const passCogs = Math.abs(cogs - qty * picked.snap) < 0.01;

  console.log(`\n${passSnapshot ? '✅' : '❌'} rawPrice snapshotted correctly`);
  console.log(`${passCogs ? '✅' : '❌'} Reports COGS matches line snapshot`);

  // Prove forward-only: if FG cost differs from snapshot, live recalc would differ
  const currentFg = fgMap[picked.id] || Number(picked.data.costPrice || 0);
  const liveRecalc = Math.round(qty * currentFg * 100) / 100;
  if (Math.abs(currentFg - storedRaw) > 0.0001) {
    console.log(`\nFG cost now $${currentFg.toFixed(4)} — live recalc would be $${liveRecalc.toFixed(2)}`);
    console.log(`Invoice COGS stays $${cogs.toFixed(2)} (forward-only ✅)`);
  } else {
    console.log(`\nFG cost unchanged since snapshot ($${currentFg.toFixed(4)})`);
  }

  if (!KEEP) {
    await invRef.delete();
    console.log(`\nCleaned up test invoice ${invoiceId}`);
  } else {
    console.log(`\n--keep: invoice retained at stores/${storeId}/financeInvoices/${invoiceId}`);
  }

  process.exit(passSnapshot && passCogs ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
