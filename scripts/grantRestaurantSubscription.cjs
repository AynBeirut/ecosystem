/**
 * Grant a 1-year Restaurant (Live Kitchen) subscription to an existing user email.
 *
 * Production resolves entitlements via the LEGACY path (VITE_ECOSYSTEM_MODULAR off),
 * where the `restaurant` module requires `pro` tier. We set both the legacy tier and a
 * modular preset so access is correct regardless of which path is active.
 *
 * Usage:
 *   node scripts/grantRestaurantSubscription.cjs --email "user@example.com"
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

// Live Kitchen (restaurant) preset — core + stock + restaurant + pos.
const RESTAURANT_MODULES = {
  invoicing: true,
  marketplace: true,
  analytics: true,
  payments: true,
  delivery: true,
  stock: true,
  restaurant: true,
  pos: true,
};

async function run() {
  console.log(`\n🍽️  Granting 1-year Restaurant subscription to ${email}...\n`);

  const userRecord = await admin.auth().getUserByEmail(email);
  const uid = userRecord.uid;

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setFullYear(endsAt.getFullYear() + 1);
  const nowIso = now.toISOString();
  const endsIso = endsAt.toISOString();

  const sellerRef = db.collection('sellers').doc(uid);
  const storeRef = db.collection('storeProfiles').doc(uid);

  await sellerRef.set(
    {
      userId: uid,
      isSeller: true,
      role: 'admin',
      updatedAt: nowIso,
    },
    { merge: true },
  );

  await storeRef.set(
    {
      ownerId: uid,
      email: userRecord.email,
      isDemo: false,

      // Subscription (legacy path is authoritative in production)
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
      subscriptionStartedAt: nowIso,
      subscriptionEndsAt: endsIso,
      subscriptionEndDate: endsIso,
      nextBillingDate: endsIso,
      isTrialUser: false,
      hasUsedTrial: true,

      // Restaurant workflow + modular preset (future-proof if modular flag turns on)
      pricingVersion: 'modular-v2',
      businessWorkflow: 'live_kitchen',
      startingPackage: 'pkg_live_kitchen',
      enabledModules: RESTAURANT_MODULES,
      seatCount: 1,
      posLocationCount: 1,
      templateColors: {
        primary: '#38B2AC',
        secondary: '#C7D2FE',
        highlight: '#C7D2FE',
      },
      financeDocumentSettings: {
        invoiceTemplate: 'basic',
        primaryColor: '#38B2AC',
        secondaryColor: '#C7D2FE',
      },

      updatedAt: nowIso,
      migrationNotes: `Restaurant (Live Kitchen) 1-year subscription granted ${nowIso} for ${email}`,
    },
    { merge: true },
  );

  const [sellerSnap, storeSnap] = await Promise.all([sellerRef.get(), storeRef.get()]);
  const sellerData = sellerSnap.data() || {};
  const storeData = storeSnap.data() || {};
  const enabled = Object.entries(storeData.enabledModules || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  console.log('✅ Restaurant subscription granted and verified:');
  console.log(`   Email: ${email}`);
  console.log(`   UID: ${uid}`);
  console.log(`   Seller role: ${sellerData.role}`);
  console.log(`   Tier / Status: ${storeData.subscriptionTier} / ${storeData.subscriptionStatus}`);
  console.log(`   Workflow: ${storeData.businessWorkflow} (${storeData.startingPackage})`);
  console.log(`   Starts: ${storeData.subscriptionStartedAt}`);
  console.log(`   Ends:   ${storeData.subscriptionEndsAt}`);
  console.log(`   Modules: ${enabled.join(', ')}`);
}

run().catch((err) => {
  console.error('❌ Failed:', err?.message || err);
  process.exit(1);
});
