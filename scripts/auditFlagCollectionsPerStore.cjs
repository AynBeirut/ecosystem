/**
 * Per active-store audit for FLAG collections + storefront collections.
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const FLAG = [
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

async function countWhere(collection, field, storeId) {
  const snap = await db.collection(collection).where(field, '==', storeId).count().get();
  return snap.data().count;
}

async function main() {
  const storesSnap = await db.collection('storeProfiles').get();
  const active = storesSnap.docs.filter((d) => {
    const s = d.data();
    return s.subscriptionStatus === 'active' || s.status === 'online';
  });

  console.log('=== Per-store FLAG usage (active/online stores) ===\n');
  for (const doc of active) {
    const sid = doc.id;
    const name = doc.data().storeName || doc.data().email || sid;
    const hits = [];
    for (const col of FLAG) {
      const n = await countWhere(col, 'storeId', sid);
      if (n > 0) hits.push(`${col}=${n}`);
    }
    const ann = await countWhere('announcements', 'storeId', sid);
    const recipes = await countWhere('recipes', 'storeId', sid);
    const rm = await countWhere('rawMaterials', 'storeId', sid);
    const projects = (
      await db.collection('stores').doc(sid).collection('projects').count().get()
    ).data().count;
    console.log(`${name.slice(0, 40).padEnd(42)} id=${sid.slice(0, 8)}…`);
    console.log(`  FLAG hits: ${hits.length ? hits.join(', ') : 'none'}`);
    console.log(`  announcements=${ann} recipes=${recipes} rawMaterials=${rm} projects=${projects}`);
  }

  // finishedGoodsTransactions detail
  const fgt = await db.collection('finishedGoodsTransactions').limit(3).get();
  console.log('\n=== finishedGoodsTransactions samples ===');
  fgt.docs.forEach((d) => console.log(JSON.stringify({ id: d.id, ...d.data() })));

  // Global non-zero FLAG (any store)
  console.log('\n=== Global non-zero FLAG (any storeId) ===');
  for (const col of FLAG) {
    const total = (await db.collection(col).count().get()).data().count;
    if (total > 0) console.log(`${col}: ${total} total docs`);
  }
}

main().catch(console.error);
