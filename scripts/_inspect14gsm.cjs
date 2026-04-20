const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
initializeApp({ credential: cert(require(path.join(__dirname, '../serviceAccountKey.json'))) });
const db = getFirestore();
// Inspect NIPCO 14 GSM doc
db.collection('rawMaterials').doc('kPWepQNvyHlOZS03ZdSx').get().then(d => {
  console.log(JSON.stringify(d.data(), null, 2));
});
