#!/usr/bin/env node
/**
 * Backfill auto financeReceipts for existing POS orders (Phase 3).
 * Usage: node scripts/backfillOrderSaleReceipts.cjs [--dry-run] [--storeId=...]
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const admin = require(join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

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
const dryRun = process.argv.includes('--dry-run');
const storeArg = process.argv.find((a) => a.startsWith('--storeId='));
const onlyStoreId = storeArg ? storeArg.split('=')[1] : null;

const COUNTED = new Set(['delivered', 'paid', 'completed']);

async function main() {
  let query = db.collection('orders');
  if (onlyStoreId) {
    query = query.where('storeId', '==', onlyStoreId);
  }
  const snap = await query.get();
  console.log(`Scanning ${snap.size} orders`);

  const { syncOrderSaleReceiptDoc } = require(join(__dirname, '..', 'functions', 'lib', 'services', 'paymentReceiptSync'));

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const status = String(data.status || '').toLowerCase();
    const paid = String(data.paymentStatus || '').toLowerCase() === 'paid';
    if (!COUNTED.has(status) && !paid) {
      skip += 1;
      continue;
    }
    if (dryRun) {
      console.log('[dry-run]', docSnap.id, data.invoiceNumber || '', data.total);
      ok += 1;
      continue;
    }
    try {
      await syncOrderSaleReceiptDoc(docSnap.id, data);
      ok += 1;
      if (ok % 50 === 0) console.log(`Processed ${ok}…`);
    } catch (err) {
      fail += 1;
      console.error('FAIL', docSnap.id, err.message || err);
    }
  }

  console.log(`Done. ok=${ok} skip=${skip} fail=${fail}${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
