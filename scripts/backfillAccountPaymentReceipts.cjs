#!/usr/bin/env node
/**
 * Backfill auto financeReceipts + GL for accountPayments (Phase C).
 * Skips superseded duplicates tagged in Phase B.
 *
 * Usage:
 *   node scripts/backfillAccountPaymentReceipts.cjs --dry-run --storeId=...
 *   node scripts/backfillAccountPaymentReceipts.cjs --write --storeId=...
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const admin = require(join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const { shouldHideLegacyAccountPayment, buildOrderReceiptIndexes } = require('./lib/accountPaymentDedupe.cjs');

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
const dryRun = !process.argv.includes('--write');
const supplierOnly = process.argv.includes('--supplier-only');
const storeArg = process.argv.find((a) => a.startsWith('--storeId='));
const onlyStoreId = storeArg ? storeArg.split('=')[1] : null;

if (!onlyStoreId) {
  console.error('Required: --storeId=...');
  process.exit(1);
}

async function main() {
  const [apSnap, recSnap] = await Promise.all([
    db.collection('accountPayments').where('storeId', '==', onlyStoreId).get(),
    db.collection('stores').doc(onlyStoreId).collection('financeReceipts').get(),
  ]);

  const receipts = recSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const indexes = buildOrderReceiptIndexes(receipts);
  const { syncAccountPaymentReceiptAndGl } = require(join(__dirname, '..', 'functions', 'lib', 'services', 'paymentReceiptSync'));

  let ok = 0;
  let skipped = 0;
  let fail = 0;

  console.log(`Store: ${onlyStoreId}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}${supplierOnly ? ' (supplier PV only)' : ''}`);
  console.log(`Account payments: ${apSnap.size}`);

  for (const docSnap of apSnap.docs) {
    const data = { id: docSnap.id, ...docSnap.data() };
    if (!data.storeId) continue;

    if (supplierOnly) {
      if (data.direction !== 'out' || data.accountType !== 'supplier') {
        skipped += 1;
        continue;
      }
    } else if (shouldHideLegacyAccountPayment(data, indexes)) {
      skipped += 1;
      if (dryRun) {
        console.log('[skip-superseded]', docSnap.id, data.accountName, data.amount, data.supersededBy || 'matched-order-receipt');
      }
      continue;
    }

    const existingAuto = receipts.find(
      (r) => r.sourceType === 'account_payment' && r.sourceId === docSnap.id,
    );
    if (existingAuto) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log('[dry-run post]', docSnap.id, data.direction, data.accountType, data.accountName, data.amount);
      ok += 1;
      continue;
    }

    try {
      await syncAccountPaymentReceiptAndGl(docSnap.id, data);
      ok += 1;
      if (ok % 10 === 0) console.log(`Processed ${ok}…`);
    } catch (err) {
      fail += 1;
      console.error('FAIL', docSnap.id, err.message || err);
    }
  }

  console.log(`Done. ok=${ok} skipped=${skipped} fail=${fail}${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
