// Simulate exactly what dispatchOrderNotifications does for our test order
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const sa = require('../serviceAccountKey.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore(app);

async function run() {
  const orderId = 'DrALCwTFuCDD8URlwhwz';
  
  // Step 1: getOrderNotificationContext
  console.log('Step 1: Reading order...');
  const orderSnap = await db.collection('orders').doc(orderId).get();
  if (!orderSnap.exists) { console.error('Order not found'); return; }
  const order = orderSnap.data();
  const storeId = String(order.storeId || '');
  console.log('storeId:', storeId);
  
  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  const storeData = storeSnap.exists ? storeSnap.data() : {};
  console.log('storeData keys:', Object.keys(storeData));

  // Step 2: upsertCustomerFromOrder — test the compound query
  console.log('Step 2: Customer upsert query...');
  try {
    const email = String(order.customerEmail || '').trim().toLowerCase();
    const existing = await db.collection('customers')
      .where('storeId', '==', storeId)
      .where('email', '==', email)
      .limit(1)
      .get();
    console.log('Customer query OK, found:', existing.size);
  } catch (e) {
    console.error('Customer query FAILED:', e.message);
    console.error('(This is likely a missing index - but should be caught)');
  }

  // Step 3: sendOwnerOrderEmail — find owner
  console.log('Step 3: Find store owner...');
  try {
    const ownerSnap = await db.collection('users').where('storeId', '==', storeId).limit(1).get();
    console.log('Owner found:', !ownerSnap.empty);
  } catch (e) {
    console.error('Owner query FAILED:', e.message);
  }

  // Step 4: createNotificationLog — test write
  console.log('Step 4: Write notification log...');
  try {
    const ref = await db.collection('orderNotifications').add({
      storeId, orderId, channel: 'email', recipient: 'test',
      provider: 'smtp', status: 'sent', reason: 'debug test',
      attempts: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Log written:', ref.id);
  } catch (e) {
    console.error('Log write FAILED:', e.message);
  }
  
  console.log('Done');
}

run().then(() => process.exit(0)).catch((e) => { console.error('UNCAUGHT:', e.message); process.exit(1); });
