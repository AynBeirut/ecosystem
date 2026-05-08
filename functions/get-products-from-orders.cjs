const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore(app);

db.collection('orders').orderBy('createdAt', 'desc').limit(3).get().then((snap) => {
  snap.docs.forEach((d) => {
    const data = d.data();
    const items = data.items || [];
    items.forEach((item) => {
      console.log(JSON.stringify({ storeId: data.storeId, productId: item.productId, name: item.name }));
    });
  });
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });
