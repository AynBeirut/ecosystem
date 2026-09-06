/**
 * Grant a store owner full modular access (all modules, active business tier).
 *
 * Usage:
 *   node scripts/provisionFullAccessStore.cjs <email> "Store Name"          # dry-run
 *   node scripts/provisionFullAccessStore.cjs <email> "Store Name" --write    # apply
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const email = String(process.argv[2] || '').trim().toLowerCase();
const storeNameArg = String(process.argv[3] || '').trim();
const write = process.argv.includes('--write');

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/provisionFullAccessStore.cjs <email> "Store Name" [--write]');
  process.exit(1);
}

const ALL_MODULE_IDS = [
  'invoicing', 'marketplace', 'analytics', 'payments', 'delivery', 'stock', 'factory',
  'restaurant', 'crm', 'team', 'dropship', 'services', 'pos', 'invoice_manager',
  'projects', 'builder', 'ai_builder', 'blog_publisher', 'whitelabel', 'admin_mobile',
  'ai_agent', 'content_creator', 'market_strategy', 'email_marketing', 'proposal_writer',
  'seo_assistant', 'analytics_insights', 'campaign_writer',
];

function modulesRecordFromList(ids) {
  const record = {};
  ALL_MODULE_IDS.forEach((id) => { record[id] = ids.includes(id); });
  return record;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'store';
}

const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json not found in project root.');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function main() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`❌ No Firebase Auth user for ${email}. Sign up first, then re-run with --write.`);
      process.exit(1);
    }
    throw err;
  }

  const userId = user.uid;
  const now = new Date().toISOString();
  const endsAt = new Date();
  endsAt.setFullYear(endsAt.getFullYear() + 1);

  const profileRef = db.collection('storeProfiles').doc(userId);
  const sellerRef = db.collection('sellers').doc(userId);
  const usersRef = db.collection('users').doc(userId);
  const storesRef = db.collection('stores').doc(userId);
  const [profileSnap, sellerSnap] = await Promise.all([profileRef.get(), sellerRef.get()]);
  const existing = profileSnap.data() || {};
  const storeName =
    storeNameArg ||
    String(existing.storeName || user.displayName || email.split('@')[0] || 'My Store').trim();

  const patch = {
    email,
    ownerEmail: email,
    ownerId: userId,
    storeName,
    name: storeName,
    storeSlug: String(existing.storeSlug || slugify(storeName)).trim(),
    status: 'online',
    pricingVersion: 'modular-v2',
    startingPackage: 'pkg_shop',
    businessWorkflow: 'shop',
    enabledModules: modulesRecordFromList(ALL_MODULE_IDS),
    seatCount: 5,
    posLocationCount: 3,
    subscriptionPlan: 'yearly',
    composedProductSource: 'platform',
    subscriptionStatus: 'active',
    subscriptionTier: 'business',
    subscriptionStartedAt: existing.subscriptionStartedAt || now,
    subscriptionEndsAt: existing.subscriptionEndsAt || endsAt.toISOString(),
    nextBillingDate: existing.nextBillingDate || endsAt.toISOString(),
    hasUsedTrial: true,
    accountingMode: 'lebanese',
    secondaryCurrency: 'LBP',
    exchangeRateMode: 'manual',
    allowsComposed: true,
    allowsManufacturing: true,
    productLimit: 50,
    storageLimitMb: 20480,
    monthlyOperationsLimit: null,
    revenueSharePercentage: 0,
    migrationNotes: `Full access provisioned manually — ${email}`,
    updatedAt: now,
    ...(profileSnap.exists ? {} : { createdAt: now }),
  };

  const preview = {
    email,
    userId,
    storeName,
    write,
    createdProfile: !profileSnap.exists,
    createSeller: !sellerSnap.exists,
    modulesEnabled: ALL_MODULE_IDS.length,
    patch,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!write) {
    console.log('\nPass --write to apply.');
    return;
  }

  const batch = db.batch();
  batch.set(profileRef, patch, { merge: true });
  batch.set(storesRef, { storeId: userId, ownerId: userId, storeName, updatedAt: now }, { merge: true });
  batch.set(sellerRef, {
    isSeller: true,
    sellerSince: now,
    role: 'admin',
    userId,
    storeId: userId,
    updatedAt: now,
  }, { merge: true });
  batch.set(usersRef, {
    email,
    name: storeName,
    storeId: userId,
    activeStoreId: userId,
    role: 'admin',
    updatedAt: now,
  }, { merge: true });
  await batch.commit();

  console.log(`\n✅ Full access store "${storeName}" provisioned for ${email}`);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
