const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
db.listCollections().then(cols => { cols.forEach(c => console.log(c.id)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
