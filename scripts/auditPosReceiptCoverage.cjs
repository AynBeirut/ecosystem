#!/usr/bin/env node
/**
 * Audit POS order receipt coverage per store (Phase 3).
 * Usage: node scripts/auditPosReceiptCoverage.cjs [--storeId=...]
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

try {
  const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (error) {
  console.error('Failed to init Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const storeArg = process.argv.find((a) => a.startsWith('--storeId='));
const onlyStoreId = storeArg ? storeArg.split('=')[1] : null;

const COUNTED = new Set(['delivered', 'paid', 'completed']);
const DEFAULT_STORES = [
  { label: 'E-Moove', id: 'EZfuoNQFTJVU4cubNuckpp4K7zw2' },
  { label: 'Little Hands', id: '8WgfKtgaE8aAXdqFhIfweEo5WFq2' },
  { label: 'Nipco', id: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82' },
];

function isCountableOrder(data) {
  const status = String(data.status || '').toLowerCase();
  const paid = String(data.paymentStatus || '').toLowerCase() === 'paid';
  return COUNTED.has(status) || paid;
}

async function auditStore(label, storeId) {
  const [ordersSnap, receiptsSnap] = await Promise.all([
    db.collection('orders').where('storeId', '==', storeId).get(),
    db.collection('stores').doc(storeId).collection('financeReceipts').get(),
  ]);

  const orderReceiptIds = new Set();
  for (const docSnap of receiptsSnap.docs) {
    const data = docSnap.data();
    if (data.sourceType === 'order' && data.sourceId) {
      orderReceiptIds.add(String(data.sourceId));
    }
  }

  let countableOrders = 0;
  let withReceipt = 0;
  let missingReceipt = 0;
  const missingSamples = [];

  for (const docSnap of ordersSnap.docs) {
    const data = docSnap.data();
    if (!isCountableOrder(data)) continue;
    countableOrders += 1;
    if (orderReceiptIds.has(docSnap.id)) {
      withReceipt += 1;
    } else {
      missingReceipt += 1;
      if (missingSamples.length < 5) {
        missingSamples.push(String(data.invoiceNumber || docSnap.id));
      }
    }
  }

  const autoOrderReceipts = receiptsSnap.docs.filter((d) => d.data().sourceType === 'order').length;

  return {
    label,
    storeId,
    totalOrders: ordersSnap.size,
    countableOrders,
    autoOrderReceipts,
    withReceipt,
    missingReceipt,
    coveragePct: countableOrders ? Math.round((withReceipt / countableOrders) * 1000) / 10 : 100,
    missingSamples,
    status: missingReceipt === 0 ? 'OK' : 'NEEDS_BACKFILL',
  };
}

async function main() {
  const targets = onlyStoreId
    ? [{ label: onlyStoreId, id: onlyStoreId }]
    : DEFAULT_STORES;

  const results = [];
  for (const store of targets) {
    results.push(await auditStore(store.label, store.id));
  }

  console.log('\n=== POS receipt coverage audit ===\n');
  for (const row of results) {
    console.log(`${row.label} (${row.storeId})`);
    console.log(`  Countable POS orders: ${row.countableOrders}`);
    console.log(`  Auto order receipts:  ${row.autoOrderReceipts}`);
    console.log(`  Matched:              ${row.withReceipt} (${row.coveragePct}%)`);
    console.log(`  Missing receipt:      ${row.missingReceipt}`);
    if (row.missingSamples.length) {
      console.log(`  Sample missing refs:  ${row.missingSamples.join(', ')}`);
    }
    console.log(`  Status:               ${row.status}`);
    console.log('');
  }

  console.log('UI note: Phase 3 hides raw order rows — only auto receipts show on Receipts page.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
