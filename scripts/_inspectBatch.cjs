const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
initializeApp({ credential: cert(require(path.join(__dirname, '../serviceAccountKey.json'))) });
const db = getFirestore();

const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const MAT_ID   = 'kPWepQNvyHlOZS03ZdSx';

async function main() {
  // Inspect a recent batch
  const batchSnap = await db.collection('productionBatches')
    .where('storeId', '==', STORE_ID)
    .get();

  const all = batchSnap.docs.sort((a,b) => (b.data().createdAt||'').localeCompare(a.data().createdAt||''));
  for (const d of all.slice(0, 2)) {
    console.log('BATCH:', d.id);
    console.log(JSON.stringify(d.data(), null, 2));
    console.log('---');
  }
}
main().catch(console.error);
