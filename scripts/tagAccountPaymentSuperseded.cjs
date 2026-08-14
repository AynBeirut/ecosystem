#!/usr/bin/env node
/**
 * Tag accountPayments superseded by existing POS order receipts (Phase B).
 * Usage:
 *   node scripts/tagAccountPaymentSuperseded.cjs --dry-run --storeId=...
 *   node scripts/tagAccountPaymentSuperseded.cjs --write --storeId=...
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const admin = require(join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const {
  findExactPartyAmountDateDuplicate,
  findSupersedingOrderReceipt,
  buildOrderReceiptIndexes,
  simulateReceiptsFeedCounts,
} = require('./lib/accountPaymentDedupe.cjs');

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
const allocationHiddenMode = process.argv.includes('--allocation-hidden');
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
  const accountPayments = apSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const indexes = buildOrderReceiptIndexes(receipts);

  const before = simulateReceiptsFeedCounts(receipts, accountPayments);
  const toTag = [];

  for (const payment of accountPayments) {
    let match;
    if (allocationHiddenMode) {
      if (payment.supersededBy || payment.duplicateOfReceipt) continue;
      match = findSupersedingOrderReceipt(payment, indexes);
      if (!match || match.reason === 'already_tagged' || match.reason === 'exact_party_amount_date') continue;
    } else {
      match = findExactPartyAmountDateDuplicate(payment, indexes);
      if (!match || match.reason === 'already_tagged') continue;
    }
    toTag.push({ payment, match });
  }

  console.log(`Store: ${onlyStoreId}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}${allocationHiddenMode ? ' (allocation-hidden)' : ' (exact)'}`);
  console.log(`Account payments: ${accountPayments.length}`);
  console.log(`Order receipts: ${before.orderReceiptCount}`);
  console.log(`Feed before — money in rows: ${before.moneyInRows} (AP shown ${before.apShown}, hidden ${before.apHidden})`);
  console.log(`Candidates to tag: ${toTag.length}`);

  let tagged = 0;
  for (const { payment, match } of toTag) {
    const payload = {
      supersededBy: `order:${match.orderId}`,
      duplicateOfReceipt: match.receiptDocId || match.receiptSourceKey || null,
      supersededReason: match.reason,
      supersededInvoiceNumber: match.invoiceNumber || null,
      supersededVoucherNumber: match.voucherNumber || null,
      supersededAt: new Date().toISOString(),
      supersededByScript: allocationHiddenMode
        ? 'tagAccountPaymentSuperseded.cjs --allocation-hidden'
        : 'tagAccountPaymentSuperseded.cjs',
    };

    if (dryRun) {
      console.log('[dry-run]', payment.id, payment.accountName, payment.amount, '→', payload.supersededBy, payload.supersededInvoiceNumber);
    } else {
      await db.collection('accountPayments').doc(payment.id).set(payload, { merge: true });
    }
    tagged += 1;
  }

  if (!dryRun) {
    const refreshed = accountPayments.map((p) => {
      const hit = toTag.find((t) => t.payment.id === p.id);
      return hit ? { ...p, ...{
        supersededBy: `order:${hit.match.orderId}`,
        duplicateOfReceipt: hit.match.receiptDocId || hit.match.receiptSourceKey,
      } } : p;
    });
    const after = simulateReceiptsFeedCounts(receipts, refreshed);
    console.log(`Feed after — money in rows: ${after.moneyInRows} (AP shown ${after.apShown}, hidden ${after.apHidden})`);
  }

  console.log(`Done. tagged=${tagged}${dryRun ? ' (dry-run)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
