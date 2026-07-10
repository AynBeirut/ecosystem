/**
 * List stores without valid subscription that exceed trial product limits.
 *
 *   node scripts/auditUnpaidStoresOverLimit.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

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
const ACTIVE = new Set(['active', 'trial', 'grace', 'grace_period']);

function effectiveLimit(profile) {
  if (typeof profile.productLimit === 'number') return profile.productLimit;
  const tier = profile.subscriptionTier || 'trial';
  const status = profile.subscriptionStatus;
  if (!status || !ACTIVE.has(status)) return 10;
  if (tier === 'business') return 50;
  if (tier === 'pro') return 20;
  if (tier === 'starter') return 8;
  return 10;
}

function isPaidOrLegacy(profile) {
  if (profile.isLegacyUser === true) return true;
  return Boolean(profile.subscriptionStatus && ACTIVE.has(profile.subscriptionStatus));
}

async function main() {
  const storesSnap = await db.collection('storeProfiles').get();
  const offenders = [];

  for (const storeDoc of storesSnap.docs) {
    const profile = storeDoc.data();
    if (profile.isDemo === true) continue;

    const count = typeof profile.catalogProductCount === 'number'
      ? profile.catalogProductCount
      : (await db.collection('products').where('storeId', '==', storeDoc.id).get()).size;

    const limit = effectiveLimit(profile);
    const paid = isPaidOrLegacy(profile);

    if (!paid && count > limit) {
      offenders.push({
        storeId: storeDoc.id,
        slug: profile.slug || profile.name || storeDoc.id,
        email: profile.email || profile.proEmail || '',
        products: count,
        limit,
        subscriptionStatus: profile.subscriptionStatus || 'MISSING',
      });
    }
  }

  offenders.sort((a, b) => b.products - a.products);
  console.log(JSON.stringify({ offenderCount: offenders.length, offenders }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
