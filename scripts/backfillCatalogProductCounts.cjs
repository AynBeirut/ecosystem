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

async function main() {
  const storesSnap = await db.collection('storeProfiles').get();
  let updated = 0;

  for (const storeDoc of storesSnap.docs) {
    const storeId = storeDoc.id;
    const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
    const count = productsSnap.size;
    const current = storeDoc.data().catalogProductCount;

    if (current === count) continue;

    console.log(`${storeDoc.data().slug || storeDoc.data().name || storeId}: ${current ?? '—'} → ${count}`);
    if (!dryRun) {
      await storeDoc.ref.set(
        {
          catalogProductCount: count,
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
