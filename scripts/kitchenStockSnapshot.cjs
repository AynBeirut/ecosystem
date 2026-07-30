/**
 * Read-only snapshot of a restaurant's raw material stock + composed products/recipes.
 * Used to prove live-kitchen deduction: run before and after a test sale, compare currentStock.
 *
 * Usage:
 *   node scripts/kitchenStockSnapshot.cjs --email "user@example.com"
 */

const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const emailArgIndex = process.argv.findIndex((arg) => arg === '--email');
const email = emailArgIndex >= 0 ? process.argv[emailArgIndex + 1] : '';

if (!email) {
  console.error('❌ Missing --email argument');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(
    readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'),
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
} catch {
  console.error('❌ Failed to initialize Firebase Admin (serviceAccountKey.json)');
  process.exit(1);
}

const db = admin.firestore();

async function resolveStoreId(userEmail) {
  // storeProfiles doc id == auth uid (see grantRestaurantSubscription.cjs).
  try {
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    return userRecord.uid;
  } catch {
    return null;
  }
}

(async () => {
  const storeId = await resolveStoreId(email);
  if (!storeId) {
    console.error(`❌ Could not resolve storeId for ${email}`);
    process.exit(1);
  }

  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  const profile = profileSnap.data() || {};

  console.log('====================================================');
  console.log(`Store: ${storeId}`);
  console.log(`  businessWorkflow    : ${profile.businessWorkflow || '(unset)'}`);
  console.log(`  composedProductSource: ${profile.composedProductSource || '(unset → platform)'}`);
  console.log(`  snapshot time        : ${new Date().toISOString()}`);
  console.log('====================================================');

  const rawSnap = await db.collection('rawMaterials').where('storeId', '==', storeId).get();
  console.log(`\nRAW MATERIALS (${rawSnap.size}):`);
  const rawById = {};
  rawSnap.forEach((doc) => {
    const d = doc.data();
    rawById[doc.id] = d;
    const stock = d.currentStock ?? d.quantity ?? 0;
    console.log(`  [${doc.id}] ${d.name}  currentStock=${stock} ${d.unit || ''}`);
  });

  const prodSnap = await db
    .collection('products')
    .where('storeId', '==', storeId)
    .where('productType', '==', 'composed')
    .get();
  console.log(`\nCOMPOSED PRODUCTS (${prodSnap.size}):`);
  for (const doc of prodSnap.docs) {
    const p = doc.data();
    console.log(`  [${doc.id}] ${p.name}  recipeId=${p.recipeId || '(none)'}`);
    if (p.recipeId) {
      const r = await db.collection('recipes').doc(p.recipeId).get();
      if (r.exists) {
        const rd = r.data();
        const list = (rd.ingredients && rd.ingredients.length ? rd.ingredients : rd.materials) || [];
        const yieldQty = rd.outputQuantity ?? rd.yieldQuantity ?? 1;
        console.log(`      recipe yield=${yieldQty}, ingredients=${list.length}`);
        list.forEach((ing) => {
          const rmId = ing.rawMaterialId || ing.materialId;
          const rm = rawById[rmId];
          console.log(`        - ${rm ? rm.name : '(missing rm ' + rmId + ')'} qty=${ing.quantity} per ${yieldQty}`);
        });
      } else {
        console.log('      ⚠️ recipe doc not found');
      }
    }
  }

  const recipesSnap = await db.collection('recipes').where('storeId', '==', storeId).get();
  console.log(`\nRECIPES (${recipesSnap.size}):`);
  recipesSnap.forEach((doc) => {
    const rd = doc.data();
    const list = (rd.ingredients && rd.ingredients.length ? rd.ingredients : rd.materials) || [];
    console.log(`  [${doc.id}] ${rd.name}  yield=${rd.outputQuantity ?? rd.yieldQuantity ?? 1}  ingredients=${list.length}`);
    list.forEach((ing) => {
      console.log(`        - rawMaterialId=${ing.rawMaterialId || ing.materialId} qty=${ing.quantity}`);
    });
  });

  const cpSnap = await db.collection('composedProducts').where('storeId', '==', storeId).get();
  console.log(`\nCOMPOSED_PRODUCTS COLLECTION (${cpSnap.size}):`);
  cpSnap.forEach((doc) => {
    const cd = doc.data();
    console.log(`  [${doc.id}] productId=${cd.productId} recipeId=${cd.recipeId}`);
  });

  console.log('\nDone.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
