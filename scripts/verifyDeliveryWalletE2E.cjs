#!/usr/bin/env node
/**
 * Delivery Wallet E2E — COD assign → collect → wallet → settle → GL.
 *
 * Usage:
 *   node scripts/verifyDeliveryWalletE2E.cjs
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
const testRunId = `delivery-wallet-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const {
  ensureDefaultChartOfAccounts,
  accountsMap,
} = require('../functions/lib/lib/ledger/postingService');
const {
  autoPostDeliveryWalletCodCollected,
  autoPostDeliveryWalletSettlement,
} = require('../functions/lib/lib/ledger/platformAutoPosting');
const { GL_ACCOUNT_CODES } = require('../functions/lib/lib/ledger/defaultChartOfAccounts');

const COD_AMOUNT = 125;
const PERSON_ID = `dp-${testRunId}`;
const ORDER_ID = `dord-${testRunId}`;

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
  const cols = ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta', 'deliveryPersons', 'deliveryOrders', 'cashCollections', 'cashBalance'];
  for (const col of cols) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
}

async function main() {
  console.log(`\n=== Delivery Wallet E2E — ${storeId} ===\n`);

  const accounts = await ensureDefaultChartOfAccounts(storeId);
  assert(accounts.some((a) => a.code === GL_ACCOUNT_CODES.DELIVERY_WALLET), 'Delivery Wallet account 1050 missing');

  const now = nowIso();

  // 1) Create delivery person
  await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(PERSON_ID).set({
    id: PERSON_ID,
    name: 'E2E Courier',
    phone: '+96170000000',
    walletBalance: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log('✓ Created delivery person');

  // 2) Assign COD order
  await db.collection('stores').doc(storeId).collection('deliveryOrders').doc(ORDER_ID).set({
    id: ORDER_ID,
    invoiceId: `INV-${testRunId}`,
    invoiceNumber: `INV-${testRunId}`,
    deliveryPersonId: PERSON_ID,
    deliveryPersonName: 'E2E Courier',
    clientName: 'COD Customer',
    amount: COD_AMOUNT,
    status: 'pending_delivery',
    assignedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  console.log('✓ Assigned COD order', ORDER_ID);

  // 3) Mark delivered
  await db.collection('stores').doc(storeId).collection('deliveryOrders').doc(ORDER_ID).update({
    status: 'delivered_unpaid',
    deliveredAt: now,
    updatedAt: now,
  });
  console.log('✓ Marked delivered');

  // 4) Mark COD collected — wallet balance + GL cod-collected
  await autoPostDeliveryWalletCodCollected(storeId, ORDER_ID, COD_AMOUNT, now, accounts);
  await db.collection('stores').doc(storeId).collection('deliveryOrders').doc(ORDER_ID).update({
    status: 'paid',
    collectedAt: now,
    updatedAt: now,
  });
  await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(PERSON_ID).update({
    walletBalance: COD_AMOUNT,
    updatedAt: now,
  });

  const personAfterCod = (await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(PERSON_ID).get()).data();
  assert(personAfterCod.walletBalance === COD_AMOUNT, `wallet should be ${COD_AMOUNT}, got ${personAfterCod.walletBalance}`);
  const walletGlAfterCod = await sumAccount(GL_ACCOUNT_CODES.DELIVERY_WALLET);
  assert(walletGlAfterCod === COD_AMOUNT, `GL delivery wallet should be ${COD_AMOUNT}, got ${walletGlAfterCod}`);
  console.log('✓ COD collected — wallet', COD_AMOUNT, '· GL wallet', walletGlAfterCod);

  // 5) Settle — GL Dr Cash Cr Delivery Wallet, wallet clears
  const settlementId = `DWST-${Date.now()}`;
  await autoPostDeliveryWalletSettlement(storeId, settlementId, COD_AMOUNT, now, accounts, undefined, 'cash');

  await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(PERSON_ID).update({
    walletBalance: 0,
    updatedAt: now,
  });
  await db.collection('stores').doc(storeId).collection('deliveryOrders').doc(ORDER_ID).update({
    returnedAt: now,
    updatedAt: now,
  });
  await db.collection('stores').doc(storeId).collection('cashCollections').doc(settlementId).set({
    id: settlementId,
    deliveryPersonId: PERSON_ID,
    deliveryPersonName: 'E2E Courier',
    orderIds: [ORDER_ID],
    totalAmount: COD_AMOUNT,
    collectedAt: now,
    destination: 'cash',
    createdAt: now,
  });

  const personAfterSettle = (await db.collection('stores').doc(storeId).collection('deliveryPersons').doc(PERSON_ID).get()).data();
  assert(personAfterSettle.walletBalance === 0, 'wallet should clear after settle');

  const cashNet = await sumAccount(GL_ACCOUNT_CODES.CASH);
  const walletNet = await sumAccount(GL_ACCOUNT_CODES.DELIVERY_WALLET);
  const revenueNet = await sumAccount(GL_ACCOUNT_CODES.REVENUE);

  assert(cashNet === COD_AMOUNT, `cash should be ${COD_AMOUNT}, got ${cashNet}`);
  assert(walletNet === 0, `delivery wallet should net 0 after settle, got ${walletNet}`);
  assert(revenueNet === -COD_AMOUNT, `revenue credit should be ${COD_AMOUNT}, got net ${revenueNet}`);

  const settleEntry = await db.collection('stores').doc(storeId).collection('journalEntries')
    .where('sourceKey', '==', `delivery_wallet:${settlementId}:settled`).limit(1).get();
  assert(!settleEntry.empty, 'settlement journal entry missing');

  console.log('✓ Settled — wallet cleared · GL cash', cashNet, '· GL wallet net', walletNet);

  console.log('\n=== PASSED — Delivery Wallet E2E ===\n');
  console.log(JSON.stringify({
    storeId,
    orderId: ORDER_ID,
    personId: PERSON_ID,
    settlementId,
    gl: { cash: cashNet, deliveryWallet: walletNet, revenue: revenueNet },
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('\n=== FAILED ===\n', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await cleanup(); } catch (e) { console.warn('cleanup:', e.message); }
  });
