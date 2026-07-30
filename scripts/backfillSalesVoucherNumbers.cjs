#!/usr/bin/env node
/**
 * Assign RV-YYYY-xxxxx to historical order sale-recognized journal entries.
 *
 *   node scripts/backfillSalesVoucherNumbers.cjs STORE_ID
 *   node scripts/backfillSalesVoucherNumbers.cjs STORE_ID --write
 *   node scripts/backfillSalesVoucherNumbers.cjs --all-lebanese --write
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
    projectId: 'market-flow-7b074',
  });
}

const db = admin.firestore();
const args = process.argv.slice(2);
const write = args.includes('--write');
const allLebanese = args.includes('--all-lebanese');
const storeIds = args.filter((a) => !a.startsWith('--'));

function yearFromDate(iso) {
  return String(iso || '').slice(0, 4) || String(new Date().getFullYear());
}

function peekNext(counters, year) {
  const key = `RV-${year}`;
  const next = (counters[key] || 0) + 1;
  return { key, next, voucherNumber: `RV-${year}-${String(next).padStart(5, '0')}` };
}

async function loadStoreIds() {
  if (storeIds.length) return storeIds;
  if (!allLebanese) {
    console.error('Usage: node scripts/backfillSalesVoucherNumbers.cjs STORE_ID [--write]');
    process.exit(1);
  }
  const snap = await db.collection('storeProfiles').where('accountingMode', '==', 'lebanese').get();
  return snap.docs.map((d) => d.id);
}

async function backfillStore(storeId) {
  const entriesSnap = await db.collection('stores').doc(storeId).collection('journalEntries').get();
  const candidates = entriesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(
      (e) =>
        e.status === 'posted' &&
        e.sourceType === 'order' &&
        e.event === 'sale-recognized' &&
        !e.voucherNumber,
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));

  console.log(`${write ? '✍' : '👀'} ${storeId}: ${candidates.length} sales JEs without RV number`);

  if (!write || candidates.length === 0) {
    return { storeId, updated: 0 };
  }

  const serialRef = db.collection('stores').doc(storeId).collection('ledgerMeta').doc('voucherSerials');
  const serialSnap = await serialRef.get();
  const counters = { ...((serialSnap.exists && serialSnap.data()?.counters) || {}) };

  let updated = 0;
  const batchLimit = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const entry of candidates) {
    const year = yearFromDate(entry.date);
    const { key, next, voucherNumber } = peekNext(counters, year);
    counters[key] = next;
    batch.update(db.collection('stores').doc(storeId).collection('journalEntries').doc(entry.id), {
      voucherType: 'RV',
      voucherNumber,
      updatedAt: new Date().toISOString(),
    });
    batchCount += 1;
    updated += 1;
    if (batchCount >= batchLimit) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();
  await serialRef.set(
    {
      storeId,
      counters,
      updatedAt: new Date().toISOString(),
      ...(serialSnap.exists ? {} : { createdAt: new Date().toISOString() }),
    },
    { merge: true },
  );

  return { storeId, updated };
}

(async () => {
  const ids = await loadStoreIds();
  const results = [];
  for (const id of ids) results.push(await backfillStore(id));
  console.log(JSON.stringify({ write, results }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
