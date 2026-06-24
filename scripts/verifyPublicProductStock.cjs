/**
 * Verify stock math matches legacy client-side calculation on prod data.
 * Usage: npm run build --prefix functions && node scripts/verifyPublicProductStock.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORES = [
  { label: 'aynbeirut', id: 'Av22LKyet8QmVcu9b8Njz1HVfoy1' },
  { label: 'nip-lb', id: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82' },
  { label: 'moove', id: '1HfsBr45XYM5SkaaazWegmyqGpA3' },
];

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}

const { calculateAvailableStock } = require('../functions/lib/lib/composedProductStock');

async function computePublicProductStock(db, storeId, productIds) {
  const uniqueIds = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
  const [recipesSnap, rmSnap] = await Promise.all([
    db.collection('recipes').where('storeId', '==', storeId).get(),
    db.collection('rawMaterials').where('storeId', '==', storeId).get(),
  ]);
  const recipes = recipesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rawMaterials = rmSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const results = [];
  for (const productId of uniqueIds) {
    const pSnap = await db.collection('products').doc(productId).get();
    if (!pSnap.exists) continue;
    const p = pSnap.data();
    if (p.storeId !== storeId) continue;
    if (p.productType === 'composed' && p.recipeId) {
      const recipe = recipes.find((r) => r.id === p.recipeId);
      const availableStock = calculateAvailableStock(recipe, rawMaterials);
      results.push({ productId, availableStock, inStock: availableStock > 0 });
    } else {
      const availableStock = Number(p.stock ?? 0);
      results.push({ productId, availableStock, inStock: p.inStock ?? availableStock > 0 });
    }
  }
  return results;
}

async function legacyStockForStore(db, storeId, productIds) {
  return computePublicProductStock(db, storeId, productIds);
}

async function main() {
  const db = admin.firestore();
  let mismatches = 0;
  let composedTotal = 0;

  console.log('=== verifyPublicProductStock (prod read-only) ===\n');

  for (const store of STORES) {
    const productsSnap = await db
      .collection('products')
      .where('storeId', '==', store.id)
      .where('productType', '==', 'composed')
      .get();

    const composedIds = productsSnap.docs.filter((d) => d.data().recipeId).map((d) => d.id);

    console.log(`${store.label} (${store.id}) composed+recipe products: ${composedIds.length}`);

    if (composedIds.length === 0) {
      console.log('  (skip — no composed products)\n');
      continue;
    }

    composedTotal += composedIds.length;
    const [apiItems, legacyItems] = await Promise.all([
      computePublicProductStock(db, store.id, composedIds),
      legacyStockForStore(db, store.id, composedIds),
    ]);

    const legacyMap = new Map(legacyItems.map((i) => [i.productId, i]));
    for (const item of apiItems) {
      const legacy = legacyMap.get(item.productId);
      const name = productsSnap.docs.find((d) => d.id === item.productId)?.data()?.name || item.productId;
      const match =
        legacy &&
        legacy.availableStock === item.availableStock &&
        legacy.inStock === item.inStock;
      if (!match) {
        mismatches += 1;
        console.log(
          `  MISMATCH ${String(name).slice(0, 40)}: api=${item.availableStock}/${item.inStock} legacy=${legacy?.availableStock}/${legacy?.inStock}`,
        );
      } else {
        console.log(`  OK ${String(name).slice(0, 40)}: stock=${item.availableStock} inStock=${item.inStock}`);
      }
    }
    console.log('');
  }

  console.log(`Compared ${composedTotal} composed products across 3 stores`);
  if (mismatches > 0) {
    console.error(`${mismatches} mismatches`);
    process.exit(1);
  }
  console.log('ALL MATCH (function logic == legacy StoreDetail math on prod data)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
