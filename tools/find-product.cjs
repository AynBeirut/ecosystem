const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

db.collection('storeProfiles').limit(5).get().then(async (snap) => {
  for (const storeDoc of snap.docs) {
    const products = await db.collection('storeProfiles').doc(storeDoc.id)
      .collection('products').where('isActive', '==', true).limit(1).get();
    if (!products.empty) {
      const p = products.docs[0];
      console.log(JSON.stringify({
        storeId: storeDoc.id,
        productId: p.id,
        name: p.data().name,
        price: p.data().price
      }));
      process.exit(0);
    }
  }
  // fallback: try root orders collection to get a storeId
  const orders = await db.collection('orders').limit(1).get();
  if (!orders.empty) {
    const o = orders.docs[0].data();
    console.log(JSON.stringify({ storeId: o.storeId, productId: (o.items||[])[0]?.productId, name: (o.items||[])[0]?.name, price: (o.items||[])[0]?.price }));
  } else {
    console.log('none');
  }
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });
