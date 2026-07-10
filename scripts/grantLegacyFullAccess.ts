/**
 * Grant full grabio.space admin platform access for an existing user email.
 *
 * Usage:
 *   npx tsx scripts/grantLegacyFullAccess.ts --email "user@example.com"
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

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

const FULL_MODULES: Record<string, boolean> = {
  invoicing: true,
  marketplace: true,
  analytics: true,
  payments: true,
  delivery: true,
  stock: true,
  factory: true,
  restaurant: true,
  crm: true,
  team: true,
  dropship: true,
  services: true,
  pos: true,
  invoice_manager: true,
  projects: true,
  builder: true,
  ai_builder: true,
  blog_publisher: true,
  whitelabel: true,
  admin_mobile: true,
  ai_agent: true,
  content_creator: true,
  market_strategy: true,
  email_marketing: true,
  proposal_writer: true,
  seo_assistant: true,
  analytics_insights: true,
  campaign_writer: true,
};

async function run() {
  console.log(`\n🔐 Granting full platform access to ${email}...\n`);

  const userRecord = await admin.auth().getUserByEmail(email);
  const uid = userRecord.uid;
  const nowIso = new Date().toISOString();

  const sellerRef = db.collection('sellers').doc(uid);
  const storeRef = db.collection('storeProfiles').doc(uid);

  await sellerRef.set(
    {
      userId: uid,
      isSeller: true,
      role: 'admin',
      updatedAt: nowIso,
      sellerSince: nowIso,
    },
    { merge: true },
  );

  await storeRef.set(
    {
      ownerId: uid,
      subscriptionStatus: 'active',
      subscriptionTier: 'business',
      isLegacyUser: true,
      isDemo: false,
      pricingVersion: 'modular-v2',
      businessWorkflow: 'shop',
      startingPackage: 'pkg_shop',
      enabledModules: FULL_MODULES,
      addOnsMeta: {
        salesCrm: true,
      },
      seatCount: 10,
      posLocationCount: 5,
      updatedAt: nowIso,
      legacyActivatedAt: nowIso,
      migrationNotes: `Legacy full-access audit account granted for ${email}`,
    },
    { merge: true },
  );

  const [sellerSnap, storeSnap] = await Promise.all([sellerRef.get(), storeRef.get()]);
  const sellerData = sellerSnap.data() || {};
  const storeData = storeSnap.data() || {};

  const enabledCount = Object.values(storeData.enabledModules || {}).filter(Boolean).length;

  console.log('✅ Access granted and verified:');
  console.log(`   Email: ${email}`);
  console.log(`   UID: ${uid}`);
  console.log(`   Seller role: ${sellerData.role}`);
  console.log(`   Subscription: ${storeData.subscriptionTier} / ${storeData.subscriptionStatus}`);
  console.log(`   Pricing version: ${storeData.pricingVersion}`);
  console.log(`   Enabled modules: ${enabledCount}`);
}

run().catch((err) => {
  console.error('❌ Failed:', err?.message || err);
  process.exit(1);
});
