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
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'market-flow-7b074',
});

const db = admin.firestore();
const { createPosOrder } = require(posSyncPath);

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
    const req = { body, query: {}, get: () => '' };
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

(async () => {
  const testRunId = `pos-order-customer-${Date.now()}`;
  const storeId = `test-${testRunId}`;
  const deviceId = `device-${testRunId}`;
  const deviceToken = `token-${testRunId}`;
  const createdAt = nowIso();

  await db.collection('storeProfiles').doc(storeId).set({
    ownerId: storeId,
    storeName: `POS Order Customer ${testRunId}`,
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
    name: 'Order Test Product',
    productType: 'simple',
    price: 10,
    costPrice: 4,
    stock: 100,
    createdAt,
    updatedAt: createdAt,
  });

  const syncedCustomerId = `pos-${storeId}-cust-123`;
  await db.collection('customers').doc(syncedCustomerId).set({
    storeId,
    localId: 'cust-123',
    name: 'Alice POS',
    phone: '70000001',
    email: 'alice@example.com',
    source: 'pos',
    createdAt,
    updatedAt: createdAt,
  });

  const auth = { storeId, deviceId, deviceToken };

  const attributed = await callHandler(createPosOrder, {
    ...auth,
    localSaleId: 'sale-attributed',
    customerId: 'cust-123',
    items: [{ productId: productRef.id, quantity: 1, unitPrice: 10 }],
    totals: { subtotal: 10, total: 10 },
    paymentMethod: 'cash',
    timestamp: createdAt,
  });

  const anonymousNamed = await callHandler(createPosOrder, {
    ...auth,
    localSaleId: 'sale-name-only',
    customerName: 'Counter Sale Bob',
    customerPhone: '71111111',
    items: [{ productId: productRef.id, quantity: 1, unitPrice: 10 }],
    totals: { subtotal: 10, total: 10 },
    paymentMethod: 'cash',
    timestamp: createdAt,
  });

  const walkIn = await callHandler(createPosOrder, {
    ...auth,
    localSaleId: 'sale-walkin',
    items: [{ productId: productRef.id, quantity: 1, unitPrice: 10 }],
    totals: { subtotal: 10, total: 10 },
    paymentMethod: 'cash',
    timestamp: createdAt,
  });

  const attributedSnap = await db.collection('orders').doc(attributed.payload.orderId).get();
  const namedSnap = await db.collection('orders').doc(anonymousNamed.payload.orderId).get();
  const walkInSnap = await db.collection('orders').doc(walkIn.payload.orderId).get();

  assert(attributedSnap.data()?.customerId === syncedCustomerId, 'Expected mapped synced customer doc id');
  assert(attributedSnap.data()?.customerName === 'Alice POS', 'Expected synced customer name');
  assert(namedSnap.data()?.customerName === 'Counter Sale Bob', 'Expected explicit customer name to be preserved');
  assert(!namedSnap.data()?.customerId, 'Name-only sale should not fabricate a customerId');
  assert(walkInSnap.data()?.customerName === 'Walk-in Customer', 'Anonymous sale should default to Walk-in Customer');

  console.log('✅ POS order customer attribution verified');
  console.log('Attributed order:', attributed.payload.orderId, attributedSnap.data()?.customerId, attributedSnap.data()?.customerName);
  console.log('Name-only order:', anonymousNamed.payload.orderId, namedSnap.data()?.customerId || '(none)', namedSnap.data()?.customerName);
  console.log('Walk-in order:', walkIn.payload.orderId, walkInSnap.data()?.customerName);
})().catch((error) => {
  console.error('❌ POS order customer attribution failed:', error.message || error);
  process.exit(1);
});
