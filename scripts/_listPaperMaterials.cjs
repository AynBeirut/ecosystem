const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
initializeApp({ credential: cert(require(path.join(__dirname, '../serviceAccountKey.json'))) });
const db = getFirestore();
db.collection('rawMaterials').get().then(snap => {
  snap.docs.forEach(d => {
    const n = (d.data().name || '').toLowerCase();
    if (n.includes('gsm') || n.includes('ply') || n.includes('paper') || n.includes('tissue') || n.includes('pulp')) {
      console.log(d.id, '|', d.data().name, '| stock:', d.data().stockQuantity, '| store:', d.data().storeId);
    }
  });
});
