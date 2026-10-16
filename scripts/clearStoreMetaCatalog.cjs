/**
 * Clear Meta catalog + pixel integration for one store (tenant-scoped).
 * Usage: node scripts/clearStoreMetaCatalog.cjs --storeId=8WgfKtgaE8aAXdqFhIfweEo5WFq2
 *    or: node scripts/clearStoreMetaCatalog.cjs --slug=little-hands
 */
const admin = require('firebase-admin');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8'),
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'market-flow-7b074',
});

const db = admin.firestore();

async function resolveStoreId() {
  if (args.storeId) {
    const snap = await db.collection('storeProfiles').doc(String(args.storeId)).get();
    if (!snap.exists) throw new Error(`storeProfiles/${args.storeId} not found`);
    return snap.id;
  }
  if (args.slug) {
    const q = await db.collection('storeProfiles').where('slug', '==', String(args.slug)).limit(1).get();
    if (q.empty) throw new Error(`No store with slug ${args.slug}`);
    return q.docs[0].id;
  }
  throw new Error('Pass --storeId=... or --slug=...');
}

async function main() {
  const storeId = await resolveStoreId();
  const ref = db.collection('storeProfiles').doc(storeId);
  const before = (await ref.get()).data() || {};
  const prevMeta = before.metaIntegrationSettings || {};

  await ref.set(
    {
      'metaIntegrationSettings.pixelEnabled': false,
      'metaIntegrationSettings.pixelId': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.catalogId': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.catalogFeedUrl': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.lastCatalogSyncAt': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.lastCatalogSyncJobId': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.lastCatalogProductCount': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.lastMetaAdsCampaignId': admin.firestore.FieldValue.delete(),
      'metaIntegrationSettings.conversionApiToken': admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const gatePath = join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-meta-catalog-removed-${new Date().toISOString().slice(0, 10)}.json`,
  );
  writeFileSync(
    gatePath,
    JSON.stringify(
      {
        action: 'remove_unrequested_meta_product_catalog',
        storeId,
        slug: before.slug || null,
        removedAt: new Date().toISOString(),
        previousMetaIntegrationSettings: prevMeta,
        note: 'Delete catalog in Meta Commerce Manager manually; no client catalog was requested.',
      },
      null,
      2,
    ),
  );

  console.log(`Cleared Meta catalog/pixel fields on storeProfiles/${storeId}`);
  console.log(`Evidence: ${gatePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
