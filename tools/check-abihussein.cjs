const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function run() {
  const customerId = 'eGYEg4GFHkRq233a7IHh';
  const storeId = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

  // Sales / invoices
  const salesSnap = await db.collection('sales').where('customerId', '==', customerId).get();
  console.log('=== INVOICES (sales) ===', salesSnap.size, 'docs');
  salesSnap.forEach(d => {
    const x = d.data();
    console.log(d.id, '|', x.invoiceNumber, '| total:', x.total, '| paid:', x.amountPaid, '| status:', x.status, x.paymentStatus, '| date:', x.createdAt);
  });

  // Cash collections linked to this customer
  const ccSnap = await db.collection('cashCollections').where('storeId', '==', storeId).get();
  console.log('\n=== CASH COLLECTIONS (filtered for this customer) ===');
  let found = 0;
  ccSnap.forEach(d => {
    const x = d.data();
    const allocs = (x.allocations || []).filter(a => a.customerName && a.customerName.includes('أبي'));
    if (allocs.length > 0) {
      found++;
      console.log(d.id, '| date:', x.collectionDate, '| total:', x.totalAmount, '| allocations:', JSON.stringify(allocs));
    }
  });
  if (found === 0) console.log('No cash collections found for this customer.');
}

run().catch(console.error);
