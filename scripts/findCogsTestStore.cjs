/**
 * Find stores with finishedGoods + finance invoices for COGS verification.
 * Read-only.
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function main() {
  const [fgSnap, storesSnap] = await Promise.all([
    db.collection('finishedGoodsInventory').get(),
    db.collection('stores').get(),
  ]);

  const fgByStore = {};
  fgSnap.forEach((d) => {
    const sid = d.data().storeId;
    if (!sid) return;
    fgByStore[sid] = (fgByStore[sid] || 0) + 1;
  });

  console.log('Stores with FG inventory:');
  for (const [sid, count] of Object.entries(fgByStore).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    const invSnap = await db.collection('stores').doc(sid).collection('financeInvoices').limit(5).get();
    const paid = invSnap.docs.filter((d) => d.data().status === 'paid').length;
    console.log(`  ${sid}: FG=${count}, sample invoices=${invSnap.size}, paid in sample=${paid}`);
  }

  // Also scan a few known stores from scripts
  const candidates = [
    'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
    'EZfuoNQFTJVU4cubNuckpp4K7zw2',
  ];
  for (const sid of candidates) {
    const invSnap = await db.collection('stores').doc(sid).collection('financeInvoices').get();
    const paid = invSnap.docs.filter((d) => d.data().status === 'paid');
    console.log(`\nCandidate ${sid}: total invoices=${invSnap.size}, paid=${paid.length}, FG=${fgByStore[sid] || 0}`);
  }
}

main().catch(console.error);
