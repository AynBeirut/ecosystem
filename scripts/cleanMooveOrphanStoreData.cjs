#!/usr/bin/env node
/**
 * Remove stranded E-Moove *test* data on legacy storeId (Firebase uid before EZfuo migration).
 * Does NOT touch store EZfuoNQFTJVU4cubNuckpp4K7zw2 (live test store + GL).
 *
 *   node scripts/cleanMooveOrphanStoreData.cjs --dry-run
 *   node scripts/cleanMooveOrphanStoreData.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ORPHAN_STORE_ID = '1HfsBr45XYM5SkaaazWegmyqGpA3';
const LIVE_STORE_ID = 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
const dryRun = !process.argv.includes('--write');

const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function collectOrphanRefs() {
  const refs = [];
  const topCollections = ['purchases', 'suppliers', 'expenses', 'products', 'orders', 'rawMaterials', 'posDevices'];
  for (const name of topCollections) {
    const snap = await db.collection(name).where('storeId', '==', ORPHAN_STORE_ID).get();
    for (const doc of snap.docs) refs.push({ path: doc.ref.path, kind: name });
  }
  const subNames = ['financeEstimates', 'financeInvoices', 'financeReceipts', 'financePurchaseOrders', 'financePaymentOrders'];
  for (const sub of subNames) {
    const snap = await db.collection('stores').doc(ORPHAN_STORE_ID).collection(sub).get();
    for (const doc of snap.docs) refs.push({ path: doc.ref.path, kind: `stores/${sub}` });
  }
  return refs;
}

(async () => {
  console.log(`\n=== Clean Moove orphan test data (${dryRun ? 'DRY-RUN' : 'WRITE'}) ===`);
  console.log('Orphan storeId:', ORPHAN_STORE_ID);
  console.log('Live storeId (untouched):', LIVE_STORE_ID, '\n');

  const refs = await collectOrphanRefs();
  if (!refs.length) {
    console.log('Nothing to delete.');
    return;
  }
  const byKind = refs.reduce((m, r) => {
    m[r.kind] = (m[r.kind] || 0) + 1;
    return m;
  }, {});
  console.log('Counts:', byKind);
  console.log('Total docs:', refs.length);

  if (dryRun) {
    refs.slice(0, 8).forEach((r) => console.log(' ', r.path));
    if (refs.length > 8) console.log(`  ... +${refs.length - 8} more`);
    console.log('\nRe-run with --write to delete.');
    return;
  }

  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.delete(db.doc(r.path)));
    await batch.commit();
  }
  console.log('Deleted', refs.length, 'docs.');

  const remaining = await collectOrphanRefs();
  console.log('Remaining orphan refs:', remaining.length);
})().catch((e) => {
  console.error('❌', e.message || e);
  process.exit(1);
});
