const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  // Try subcollection first
  const stores = await db.collection('storeProfiles').limit(10).get();
  for (const storeDoc of stores.docs) {
    const prods = await db.collection('storeProfiles').doc(storeDoc.id)
      .collection('products').where('isActive', '==', true).limit(1).get();
    if (!prods.empty) {
      const p = prods.docs[0];
      console.log(JSON.stringify({ storeId: storeDoc.id, productId: p.id, name: p.data().name, price: p.data().price, source: 'subcollection' }));
      return;
    }
  }
  // Try root products
  const rp = await db.collection('products').where('isActive', '==', true).limit(1).get();
  if (!rp.empty) {
    const p = rp.docs[0];
    console.log(JSON.stringify({ storeId: p.data().storeId, productId: p.id, name: p.data().name, price: p.data().price, source: 'root' }));
    return;
  }
  console.log('No active products found anywhere');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
