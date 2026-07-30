#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
process.env.ECOSYSTEM_MODULAR = 'true';

const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found in workspace root');
  process.exit(1);
}

const posSyncPath = path.join(repoRoot, 'functions', 'lib', 'api', 'posSync.js');
const postingServicePath = path.join(
  repoRoot,
  'functions',
  'lib',
  'lib',
  'ledger',
  'postingService.js',
);

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'market-flow-7b074',
});

const db = admin.firestore();
const {
  syncPosPurchases,
  syncPosExpenses,
  syncPosSalaries,
  syncPosRefunds,
} = require(posSyncPath);
const { buildSourceKey } = require(postingServicePath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

async function callHandler(handler, body) {
  let statusCode = 200;

  return new Promise((resolve, reject) => {
    const req = {
      body,
      query: {},
      get: () => '',
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        if (statusCode >= 400) {
          reject(new Error(`HTTP ${statusCode}: ${JSON.stringify(payload)}`));
          return this;
        }
        resolve({ status: statusCode, payload });
        return this;
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

async function getJournalEntryBySourceKey(storeId, sourceKey) {
  const snap = await db
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('sourceKey', '==', sourceKey)
    .get();
  assert(snap.size === 1, `Expected exactly one journal entry for ${sourceKey}, got ${snap.size}`);
  return snap.docs[0];
}

async function getJournalLines(storeId, entryId) {
  const snap = await db
    .collection('stores')
    .doc(storeId)
    .collection('journalLines')
    .where('entryId', '==', entryId)
    .get();
  return snap.docs.map((doc) => doc.data());
}

function assertLine(lines, accountCode, expectedDebit, expectedCredit) {
  const line = lines.find((item) => item.accountCode === accountCode);
  assert(line, `Missing line for account ${accountCode}`);
  assert(Number(line.debit || 0) === expectedDebit, `Expected debit ${expectedDebit} on ${accountCode}, got ${line.debit}`);
  assert(Number(line.credit || 0) === expectedCredit, `Expected credit ${expectedCredit} on ${accountCode}, got ${line.credit}`);
}

(async () => {
  const testRunId = `pos-gl-${Date.now()}`;
  const storeId = `test-${testRunId}`;
  const deviceId = `device-${testRunId}`;
  const deviceToken = `token-${testRunId}`;
  const createdAt = nowIso();

  await db.collection('storeProfiles').doc(storeId).set({
    ownerId: storeId,
    storeName: `POS GL Test ${testRunId}`,
    mainCurrency: 'USD',
    subscriptionStatus: 'active',
    subscriptionTier: 'pro',
    pricingVersion: 'modular-v2',
    startingPackage: 'pkg_live_kitchen',
    posLocationCount: 1,
    enabledModules: {
      invoicing: true,
      marketplace: true,
      analytics: true,
      payments: true,
      delivery: true,
      stock: true,
      restaurant: true,
      pos: true,
    },
    createdAt,
    updatedAt: createdAt,
  });

  await db.collection('stores').doc(storeId).collection('posDevices').doc(deviceId).set({
    deviceName: 'E2E POS',
    platform: 'windows',
    composedProductSource: 'platform',
    pairedAt: admin.firestore.FieldValue.serverTimestamp(),
    apiKeyHash: hashToken(deviceToken),
  });

  const productRef = db.collection('products').doc();
  await productRef.set({
    storeId,
    name: 'Refund Test Product',
    productType: 'simple',
    costPrice: 8,
    price: 15,
    createdAt,
    updatedAt: createdAt,
  });

  const orderRef = db.collection('orders').doc();
  await orderRef.set({
    storeId,
    source: 'pos',
    localSaleId: 'sale-local-1',
    invoiceNumber: 'POS-001',
    paymentMethod: 'cash',
    total: 30,
    status: 'completed',
    paymentStatus: 'paid',
    items: [
      {
        productId: productRef.id,
        quantity: 2,
        price: 15,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });

  const auth = { storeId, deviceId, deviceToken };

  await callHandler(syncPosPurchases, {
    ...auth,
    purchases: [
      {
        id: 'purchase-1',
        supplierName: 'Vendor One',
        date: createdAt,
        items: [{ quantity: 5, unitPrice: 4 }],
        totalAmount: 20,
        status: 'received',
      },
    ],
  });

  await callHandler(syncPosExpenses, {
    ...auth,
    expenses: [
      {
        id: 'expense-1',
        category: 'utilities',
        description: 'Electric bill',
        amount: 12,
        date: createdAt,
        paymentMethod: 'bank',
      },
    ],
  });

  await callHandler(syncPosSalaries, {
    ...auth,
    salaries: [
      {
        id: 'salary-1',
        staffId: 'staff-1',
        netAmount: 50,
        paymentDate: createdAt,
        paymentMethod: 'cash',
        status: 'paid',
      },
    ],
  });

  await callHandler(syncPosRefunds, {
    ...auth,
    refunds: [
      {
        id: 'refund-1',
        saleId: 'sale-local-1',
        refundAmount: 30,
        refundType: 'full',
        refundItems: [{ productId: productRef.id, quantity: 2 }],
        paymentMethod: 'cash',
        timestamp: createdAt,
      },
    ],
  });

  await callHandler(syncPosPurchases, {
    ...auth,
    purchases: [
      {
        id: 'purchase-1',
        supplierName: 'Vendor One',
        date: createdAt,
        items: [{ quantity: 5, unitPrice: 4 }],
        totalAmount: 20,
        status: 'received',
      },
    ],
  });

  await callHandler(syncPosExpenses, {
    ...auth,
    expenses: [
      {
        id: 'expense-1',
        category: 'utilities',
        description: 'Electric bill',
        amount: 12,
        date: createdAt,
        paymentMethod: 'bank',
      },
    ],
  });

  await callHandler(syncPosSalaries, {
    ...auth,
    salaries: [
      {
        id: 'salary-1',
        staffId: 'staff-1',
        netAmount: 50,
        paymentDate: createdAt,
        paymentMethod: 'cash',
        status: 'paid',
      },
    ],
  });

  await callHandler(syncPosRefunds, {
    ...auth,
    refunds: [
      {
        id: 'refund-1',
        saleId: 'sale-local-1',
        refundAmount: 30,
        refundType: 'full',
        refundItems: [{ productId: productRef.id, quantity: 2 }],
        paymentMethod: 'cash',
        timestamp: createdAt,
      },
    ],
  });

  const purchaseDocId = `pos-${storeId}-purchase-1`;
  const expenseDocId = `pos-${storeId}-expense-1`;
  const salaryDocId = `pos-${storeId}-salary-1`;
  const refundDocId = `pos-${storeId}-refund-1`;

  const purchaseEntry = await getJournalEntryBySourceKey(
    storeId,
    buildSourceKey('purchase', purchaseDocId, 'received'),
  );
  const expenseEntry = await getJournalEntryBySourceKey(
    storeId,
    buildSourceKey('expense', expenseDocId, 'paid'),
  );
  const salaryEntry = await getJournalEntryBySourceKey(
    storeId,
    buildSourceKey('payroll', salaryDocId, 'paid'),
  );
  const refundEntry = await getJournalEntryBySourceKey(
    storeId,
    buildSourceKey('order', orderRef.id, `reversal-${refundDocId}`),
  );

  const purchaseLines = await getJournalLines(storeId, purchaseEntry.id);
  assertLine(purchaseLines, '1200', 20, 0);
  assertLine(purchaseLines, '2000', 0, 20);

  const expenseLines = await getJournalLines(storeId, expenseEntry.id);
  assertLine(expenseLines, '6010', 12, 0);
  assertLine(expenseLines, '1010', 0, 12);

  const salaryLines = await getJournalLines(storeId, salaryEntry.id);
  assertLine(salaryLines, '6020', 50, 0);
  assertLine(salaryLines, '1000', 0, 50);

  const refundLines = await getJournalLines(storeId, refundEntry.id);
  assertLine(refundLines, '4000', 30, 0);
  assertLine(refundLines, '1000', 0, 30);
  assertLine(refundLines, '1201', 16, 0);
  assertLine(refundLines, '5000', 0, 16);

  const [purchaseSnap, expenseSnap, salarySnap, refundSnap] = await Promise.all([
    db.collection('purchases').doc(purchaseDocId).get(),
    db.collection('expenses').doc(expenseDocId).get(),
    db.collection('salaryPayments').doc(salaryDocId).get(),
    db.collection('salesReturns').doc(refundDocId).get(),
  ]);

  assert(purchaseSnap.data()?.glPostingStatus === 'posted', 'Purchase doc not marked as posted');
  assert(expenseSnap.data()?.glPostingStatus === 'posted', 'Expense doc not marked as posted');
  assert(salarySnap.data()?.glPostingStatus === 'posted', 'Salary doc not marked as posted');
  assert(refundSnap.data()?.glPostingStatus === 'posted', 'Refund doc not marked as posted');

  console.log('✅ POS GL sync E2E verified');
  console.log(`Store: ${storeId}`);
  console.log(`Purchase journal: ${purchaseEntry.id}`);
  console.log(`Expense journal : ${expenseEntry.id}`);
  console.log(`Salary journal  : ${salaryEntry.id}`);
  console.log(`Refund journal  : ${refundEntry.id}`);
})().catch((error) => {
  console.error('❌ POS GL sync E2E failed:', error.message || error);
  process.exit(1);
});
