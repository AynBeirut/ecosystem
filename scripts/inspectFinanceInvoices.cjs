const admin = require('firebase-admin');
const path = require('path');
const storeId = process.argv[2] || 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const snap = await db.collection('stores').doc(storeId).collection('financeInvoices').get();
  console.log(`financeInvoices: ${snap.size}`);
  snap.docs.forEach((d) => {
    const data = d.data();
    const items = data.lineItems || data.items || [];
    console.log(`  ${d.id} status=${data.status} date=${data.date} items=${items.length} amount=${data.amount}`);
    if (items[0]) {
      const it = items[0];
      console.log(`    first line: id=${it.id} qty=${it.quantity} rawPrice=${it.rawPrice} desc=${it.description}`);
    }
  });
}
main();
