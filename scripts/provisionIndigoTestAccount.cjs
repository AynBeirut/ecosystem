/**
 * Provision test@indigo.com as legacy business account with full ecosystem access.
 * Usage: node scripts/provisionIndigoTestAccount.cjs --write
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const EMAIL = 'test@indigo.com';
const LEGACY_EXPIRY = '2027-06-24T23:59:59.000Z';

const ALL_LEGACY_ADDONS = ['salesCrm', 'domainPackage', 'whatsappBusiness', 'extraStorage'];
const ADDONS_META = {
  salesCrm: true,
  domainPackage: true,
  whatsappBusiness: true,
  extraStorage: true,
};

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function main() {
  const write = process.argv.includes('--write');
  const user = await admin.auth().getUserByEmail(EMAIL);
  const uid = user.uid;
  const now = new Date().toISOString();

  const sellerRef = db.collection('sellers').doc(uid);
  const profileRef = db.collection('storeProfiles').doc(uid);
  const usersRef = db.collection('users').doc(uid);

  const [sellerSnap, profileSnap] = await Promise.all([sellerRef.get(), profileRef.get()]);
  const sellerCountSnap = await db.collection('sellers').count().get();
  const sellerIndex = sellerCountSnap.data().count + (sellerSnap.exists ? 0 : 1);

  const storeProfile = {
    email: EMAIL,
    storeName: 'Indigo Ecosystem Test',
    storeSlug: 'indigo-test',
    description: 'Legacy test store for ecosystem QA — client demo account',
    location: 'Beirut, Lebanon',
    status: 'online',
    template: 'default',
    subscriptionTier: 'business',
    subscriptionStatus: 'active',
    pricingVersion: 'legacy-v1',
    businessWorkflow: 'factory',
    allowsManufacturing: true,
    isLegacyUser: true,
    legacyActivatedAt: now,
    legacyExpiresAt: LEGACY_EXPIRY,
    subscriptionStartedAt: now,
    subscriptionEndsAt: LEGACY_EXPIRY,
    subscriptionEndDate: admin.firestore.Timestamp.fromDate(new Date(LEGACY_EXPIRY)),
    nextBillingDate: LEGACY_EXPIRY,
    isTrialUser: false,
    hasUsedTrial: true,
    addOns: ALL_LEGACY_ADDONS,
    addOnsMeta: ADDONS_META,
    migrationNotes: 'Indigo ecosystem test account — legacy business + all add-ons',
    createdAt: profileSnap.exists ? profileSnap.data()?.createdAt || now : now,
    updatedAt: now,
  };

  const seller = {
    isSeller: true,
    sellerSince: sellerSnap.exists ? sellerSnap.data()?.sellerSince || now : now,
    sellerIndex: sellerSnap.exists ? sellerSnap.data()?.sellerIndex || sellerIndex : sellerIndex,
    role: 'admin',
    userId: uid,
    storeId: uid,
    updatedAt: now,
  };

  const userDoc = {
    email: EMAIL,
    storeId: uid,
    role: 'admin',
    updatedAt: now,
  };

  const preview = { uid, email: EMAIL, storeProfile, seller, userDoc, write };
  console.log(JSON.stringify(preview, null, 2));

  if (!write) {
    console.log('\nPass --write to apply (test@indigo.com only).');
    return;
  }

  const batch = db.batch();
  batch.set(profileRef, storeProfile, { merge: true });
  batch.set(sellerRef, seller, { merge: true });
  batch.set(usersRef, userDoc, { merge: true });
  await batch.commit();

  console.log('\n✅ Provisioned test@indigo.com');
  console.log(`   UID: ${uid}`);
  console.log(`   Store: /store/indigo-test`);
  console.log(`   Admin: /admin`);
  console.log(`   Tier: business (legacy-v1) until ${LEGACY_EXPIRY.split('T')[0]}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
