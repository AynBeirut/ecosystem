/**
 * Read-only prod audit: doc counts for FLAG collections (deny-by-default gaps).
 * Usage: node scripts/auditFlagCollections.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const FLAG_COLLECTIONS = [
  'announcements',
  'fulfillmentLocations',
  'orderViews',
  'accountStatements',
  'cashCollections',
  'monthlyServiceCosts',
  'salaryPayments',
  'serviceRenewalCharges',
  'finishedGoodsTransactions',
  'marketplaceSyncJobs',
  'marketplaceChannelSettings',
  'marketplaceConnectionTests',
  'trialOperationUsage',
];

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function countCollection(name) {
  try {
    const agg = await db.collection(name).count().get();
    return agg.data().count;
  } catch (err) {
    return { error: err.message };
  }
}

async function sampleStoreIds(name, field = 'storeId') {
  const snap = await db.collection(name).limit(5).get();
  if (snap.empty) return [];
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, storeId: data[field] || data.store_id || null };
  });
}

async function countProjectsSubcollection() {
  const storesSnap = await db.collection('storeProfiles').select().get();
  let total = 0;
  const byStore = [];
  for (const storeDoc of storesSnap.docs) {
    const projSnap = await db.collection('stores').doc(storeDoc.id).collection('projects').count().get();
    const n = projSnap.data().count;
    if (n > 0) byStore.push({ storeId: storeDoc.id, count: n });
    total += n;
  }
  return { total, byStore };
}

async function main() {
  console.log('=== FLAG collection prod audit (read-only) ===\n');
  const rows = [];
  for (const name of FLAG_COLLECTIONS) {
    const count = await countCollection(name);
    let samples = [];
    if (typeof count === 'number' && count > 0) {
      samples = await sampleStoreIds(name);
    }
    rows.push({ name, count, samples });
    const sampleStr =
      samples.length > 0
        ? samples.map((s) => `${s.storeId || s.id}`).join(', ')
        : '—';
    console.log(`${name.padEnd(28)} count=${count}\tsamples=${sampleStr}`);
  }

  const projects = await countProjectsSubcollection();
  console.log(`\nstores/{id}/projects\t total=${projects.total}`);
  if (projects.byStore.length) {
    for (const p of projects.byStore) {
      console.log(`  store ${p.storeId}: ${p.count} docs`);
    }
  }

  // Active stores with subscription
  const activeSnap = await db
    .collection('storeProfiles')
    .where('subscriptionStatus', '==', 'active')
    .select('storeName', 'email')
    .get();
  console.log(`\nActive subscription stores: ${activeSnap.size}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
