const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
  const customerId = 'eGYEg4GFHkRq233a7IHh';
  const storeId = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

  // Orders for this customer
  const ordersSnap = await db.collection('orders').where('customerId', '==', customerId).get();
  console.log('=== ORDERS ===', ordersSnap.size, 'docs');
  let totalDebit = 0;
  let totalCredit = 0;
  ordersSnap.forEach(d => {
    const x = d.data();
    const paid = Number(x.amountPaid) || 0;
    const total = Number(x.total) || 0;
    totalDebit += total;
    totalCredit += paid;
    console.log(d.id, '|', x.invoiceNumber, '| total:', total, '| paid:', paid, '| balance:', total - paid, '| status:', x.status, x.paymentStatus, '| date:', x.createdAt);
  });
  console.log('\nTotals -> Debit:', totalDebit.toFixed(2), '| Credit:', totalCredit.toFixed(2), '| Balance:', (totalDebit - totalCredit).toFixed(2));

  // shadowLedger entries for this customer
  const ledgerSnap = await db.collection('shadowLedger').where('customerId', '==', customerId).get();
  console.log('\n=== SHADOW LEDGER ===', ledgerSnap.size, 'docs');
  ledgerSnap.forEach(d => {
    const x = d.data();
    console.log(d.id, '| type:', x.type, '| amount:', x.amount, '| ref:', x.reference, '| date:', x.date || x.createdAt);
  });

  // cashCollections - check allocations
  const ccSnap = await db.collection('cashCollections').where('storeId', '==', storeId).get();
  console.log('\n=== CASH COLLECTIONS for this customer ===');
  let found = 0;
  ccSnap.forEach(d => {
    const x = d.data();
    const allocs = (x.allocations || []).filter(a => a.customerId === customerId || (a.customerName && a.customerName.includes('أبي')));
    if (allocs.length > 0) {
      found++;
      console.log(d.id, '| date:', x.collectionDate, '| total:', x.totalAmount, '| allocs:', JSON.stringify(allocs));
    }
  });
  if (found === 0) console.log('None found.');
}

run().catch(console.error).finally(() => process.exit(0));
