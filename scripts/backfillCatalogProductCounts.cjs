/**
 * Backfill storeProfiles.catalogProductCount from products collection.
 * Run before deploying Firestore rules that enforce product caps.
 *
 *   node scripts/backfillCatalogProductCounts.cjs
 *   node scripts/backfillCatalogProductCounts.cjs --dry-run
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const dryRun = process.argv.includes('--dry-run');

try {
  const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (error) {
  console.error('Failed to init Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const CATALOG_PRODUCT_COUNT_VERSION = 2;

function isCatalogCountableProductData(data) {
  if (!data) return false;
  const rawType = String(data.productType ?? data.type ?? '').trim().toLowerCase();
  const itemType = String(data.itemType ?? '').trim().toLowerCase();
  if (data.isSellable === false) return false;
  if (data.excludeFromCatalogCount === true) return false;
  if (itemType === 'raw_material' || itemType === 'ingredient') return false;
  return !['raw_material', 'raw-material', 'ingredient', 'material', 'component', 'recipe_ingredient'].includes(rawType);
}

async function main() {
  const storesSnap = await db.collection('storeProfiles').get();
  let updated = 0;

  for (const storeDoc of storesSnap.docs) {
    const storeId = storeDoc.id;
    const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
    const count = productsSnap.docs.filter((doc) => isCatalogCountableProductData(doc.data() || {})).length;
    const current = storeDoc.data().catalogProductCount;
    const currentVersion = storeDoc.data().catalogProductCountVersion;

    if (current === count && currentVersion === CATALOG_PRODUCT_COUNT_VERSION) continue;

    console.log(`${storeDoc.data().slug || storeDoc.data().name || storeId}: ${current ?? '—'} → ${count} (v${currentVersion ?? 0} → v${CATALOG_PRODUCT_COUNT_VERSION})`);
    if (!dryRun) {
      await storeDoc.ref.set(
        {
          catalogProductCount: count,
          catalogProductCountVersion: CATALOG_PRODUCT_COUNT_VERSION,
          catalogProductCountSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    }
    updated += 1;
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${updated} store profile(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
