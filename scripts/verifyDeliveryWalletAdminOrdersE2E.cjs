#!/usr/bin/env node
/**
 * Delivery Wallet E2E — Admin Orders COD flow (deliver → wallet → settle → GL).
 *
 * Usage:
 *   node scripts/verifyDeliveryWalletAdminOrdersE2E.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const functionsAdmin = require('../functions/node_modules/firebase-admin');
if (!functionsAdmin.apps.length) {
  functionsAdmin.initializeApp({
    credential: functionsAdmin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
}

const db = admin.firestore();
const testRunId = `dw-admin-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;
const orderId = `order-${testRunId}`;
const personId = `dp-${testRunId}`;
const COD_AMOUNT = 188;

const {
  ensureDefaultChartOfAccounts,
  accountByCode,
} = require('../functions/lib/lib/ledger/postingService');
const {
  autoPostOrderSaleRecognized,
  autoPostDeliveryWalletSettlement,
} = require('../functions/lib/lib/ledger/platformAutoPosting');
const { GL_ACCOUNT_CODES } = require('../functions/lib/lib/ledger/defaultChartOfAccounts');

function assert(c, m) { if (!c) throw new Error(m); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function nowIso() { return new Date().toISOString(); }

async function sumAccount(code) {
  const snap = await db.collection('stores').doc(storeId).collection('journalLines')
    .where('accountCode', '==', code).get();
  let net = 0;
  snap.forEach((d) => {
    const row = d.data();
    net += round2(row.debit || 0) - round2(row.credit || 0);
  });
  return round2(net);
}

async function cleanup() {
  const storeCols = ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta', 'deliveryPersons', 'deliveryOrders', 'cashCollections', 'cashBalance'];
  for (const col of storeCols) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
  await db.collection('orders').doc(orderId).delete().catch(() => {});
}

async function syncWalletSubledger() {
  const now = nowIso();
  await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(personId).set({
    id: personId,
    name: 'E2E Courier',
    phone: '+96171111111',
    walletBalance: COD_AMOUNT,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  await db.collection('stores').doc(storeId).collection('deliveryOrders').doc(orderId).set({
    id: orderId,
    platformOrderId: orderId,
    invoiceId: orderId,
    invoiceNumber: `INV-${testRunId}`,
    deliveryPersonId: personId,
    deliveryPersonName: 'E2E Courier',
    clientName: 'COD Customer',
    amount: COD_AMOUNT,
    status: 'paid',
    source: 'platform',
    assignedAt: now,
    deliveredAt: now,
    collectedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('stores').doc(storeId).collection('cashBalance').doc('current').set({
    deliveryHeldCash: COD_AMOUNT,
    cashOnHand: 0,
    bankBalance: 0,
    lastUpdated: now,
  }, { merge: true });
}

async function main() {
  console.log(`\n=== Delivery Wallet Admin Orders E2E — ${storeId} ===\n`);

  const accounts = await ensureDefaultChartOfAccounts(storeId);
  assert(accounts.some((a) => a.code === GL_ACCOUNT_CODES.DELIVERY_WALLET), 'missing 1050');

  const now = nowIso();

  // 1) Platform COD order (unpaid cash — like Cart checkout)
  await db.collection('orders').doc(orderId).set({
    storeId,
    invoiceNumber: `INV-${testRunId}`,
    customerName: 'COD Customer',
    total: COD_AMOUNT,
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    amountPaid: 0,
    status: 'ready',
    assignedDeliveryPerson: personId,
    assignedDeliveryPersonName: 'E2E Courier',
    items: [{ productId: 'prod-test', quantity: 1, price: COD_AMOUNT }],
    createdAt: now,
  });
  console.log('✓ Created COD platform order', orderId);

  // 2) Admin marks delivered → GL sale-recognized with Delivery Wallet debit
  await autoPostOrderSaleRecognized(
    storeId,
    {
      id: orderId,
      storeId,
      date: now,
      total: COD_AMOUNT,
      paymentMethod: 'cash',
      invoiceNumber: `INV-${testRunId}`,
      cogsLines: [],
      isCashSale: false,
      isCodDelivery: true,
    },
    accounts,
  );

  await db.collection('orders').doc(orderId).update({ status: 'delivered', updatedAt: now });
  await syncWalletSubledger();

  const walletGl = await sumAccount(GL_ACCOUNT_CODES.DELIVERY_WALLET);
  assert(walletGl === COD_AMOUNT, `GL wallet should be ${COD_AMOUNT}, got ${walletGl}`);

  const person = (await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(personId).get()).data();
  assert(person.walletBalance === COD_AMOUNT, `courier wallet should be ${COD_AMOUNT}`);

  const saleEntry = await db.collection('stores').doc(storeId).collection('journalEntries')
    .where('sourceKey', '==', `order:${orderId}:sale-recognized`).limit(1).get();
  assert(!saleEntry.empty, 'sale-recognized journal missing');

  const saleLines = await db.collection('stores').doc(storeId).collection('journalLines')
    .where('entryId', '==', saleEntry.docs[0].id).get();
  const debits = saleLines.docs.filter((d) => d.data().accountCode === GL_ACCOUNT_CODES.DELIVERY_WALLET);
  assert(debits.length === 1 && debits[0].data().debit === COD_AMOUNT, 'sale should Dr Delivery Wallet');

  console.log('✓ Delivered COD — GL Dr Delivery Wallet', walletGl, '· courier wallet', COD_AMOUNT);

  // 3) Settle wallet
  const settlementId = `DWST-${Date.now()}`;
  await autoPostDeliveryWalletSettlement(storeId, settlementId, COD_AMOUNT, now, accounts, undefined, 'cash');

  await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(personId).update({ walletBalance: 0 });
  await db.collection('stores').doc(storeId).collection('deliveryOrders').doc(orderId).update({ returnedAt: now });

  const cashNet = await sumAccount(GL_ACCOUNT_CODES.CASH);
  const walletNet = await sumAccount(GL_ACCOUNT_CODES.DELIVERY_WALLET);
  assert(cashNet === COD_AMOUNT, `cash should be ${COD_AMOUNT}, got ${cashNet}`);
  assert(walletNet === 0, `wallet net should be 0, got ${walletNet}`);

  console.log('✓ Settled — GL cash', cashNet, '· wallet cleared');

  console.log('\n=== PASSED — Admin Orders delivery wallet E2E ===\n');
  console.log(JSON.stringify({ storeId, orderId, personId, settlementId, gl: { cash: cashNet, deliveryWallet: walletNet } }, null, 2));
}

main()
  .catch((err) => {
    console.error('\n=== FAILED ===\n', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await cleanup(); } catch (e) { console.warn('cleanup:', e.message); }
  });
