#!/usr/bin/env node

/**
 * Real Firestore-backed verification for the materialId/rawMaterialId kitchen deduction fix.
 *
 * It seeds a temporary live-kitchen store using a recipe ingredient that only has `materialId`,
 * invokes the compiled kitchen deduction service, and confirms raw material stock decreases.
 *
 * Usage:
 *   npm run build --prefix functions
 *   node scripts/verifyKitchenDeductionMaterialIdE2E.cjs
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found in workspace root');
  process.exit(1);
}

const compiledServicePath = path.join(
  repoRoot,
  'functions',
  'lib',
  'services',
  'kitchenSaleDeduction.js',
);

if (!fs.existsSync(compiledServicePath)) {
  console.error('❌ Compiled functions service not found. Run: npm run build --prefix functions');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'market-flow-7b074',
});

const db = admin.firestore();
const { deductComposedIngredientsOnSale } = require(compiledServicePath);

function nowIso() {
  return new Date().toISOString();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const testRunId = `kitchen-materialid-${Date.now()}`;
  const storeId = `test-${testRunId}`;
  const rawMaterialRef = db.collection('rawMaterials').doc();
  const recipeRef = db.collection('recipes').doc();
  const productRef = db.collection('products').doc();
  const orderId = `order-${testRunId}`;
  const createdAt = nowIso();

  await db.collection('storeProfiles').doc(storeId).set({
    storeName: `Kitchen Fix ${testRunId}`,
    subscriptionStatus: 'active',
    subscriptionTier: 'pro',
    businessWorkflow: 'live_kitchen',
    composedProductSource: 'platform',
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

  await rawMaterialRef.set({
    storeId,
    name: 'Flour Test Material',
    unit: 'kg',
    currentStock: 10,
    costPerUnit: 1,
    createdAt,
    updatedAt: createdAt,
  });

  await recipeRef.set({
    storeId,
    name: 'Test Recipe With materialId Only',
    outputQuantity: 1,
    ingredients: [
      {
        materialId: rawMaterialRef.id,
        quantity: 2,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });

  await productRef.set({
    storeId,
    name: 'Composed Test Product',
    productType: 'composed',
    recipeId: recipeRef.id,
    createdAt,
    updatedAt: createdAt,
  });

  const beforeSnap = await rawMaterialRef.get();
  const beforeStock = Number(beforeSnap.data()?.currentStock || 0);

  const result = await deductComposedIngredientsOnSale(storeId, orderId, [
    {
      productId: productRef.id,
      quantity: 2,
    },
  ]);

  const afterSnap = await rawMaterialRef.get();
  const afterStock = Number(afterSnap.data()?.currentStock || 0);

  console.log('Store:', storeId);
  console.log('Recipe:', recipeRef.id, '(ingredient uses materialId only)');
  console.log('Product:', productRef.id);
  console.log('Before stock:', beforeStock);
  console.log('After stock :', afterStock);
  console.log('Deduction result:', result);

  assert(result.deducted === 1, `Expected deducted=1, got ${result.deducted}`);
  assert(afterStock === 6, `Expected raw material stock to drop from 10 to 6, got ${afterStock}`);

  console.log('✅ Verified: materialId-only recipe deducted raw materials correctly.');
})().catch((error) => {
  console.error('❌ Verification failed:', error.message || error);
  process.exit(1);
});
