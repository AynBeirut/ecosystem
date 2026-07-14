/**
 * Grant any email the Live Kitchen (resto) modular package.
 *
 * Usage:
 *   node scripts/provisionLiveKitchenPackage.cjs <email>          # dry-run
 *   node scripts/provisionLiveKitchenPackage.cjs <email> --write  # apply
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const email = String(process.argv[2] || '').trim().toLowerCase();
const write = process.argv.includes('--write');

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/provisionLiveKitchenPackage.cjs <email> [--write]');
  process.exit(1);
}

const PRESET = 'pkg_live_kitchen';
const LIVE_KITCHEN_MODULES = [
  'invoicing',
  'marketplace',
  'analytics',
  'payments',
  'delivery',
  'stock',
  'restaurant',
  'pos',
];

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
  const user = await admin.auth().getUserByEmail(email);
  const userId = user.uid;
  const now = new Date().toISOString();
  const endsAt = new Date();
  endsAt.setFullYear(endsAt.getFullYear() + 1);

  const profileRef = db.collection('storeProfiles').doc(userId);
  const sellerRef = db.collection('sellers').doc(userId);
  const usersRef = db.collection('users').doc(userId);
  const [profileSnap, sellerSnap] = await Promise.all([profileRef.get(), sellerRef.get()]);
  const existing = profileSnap.data() || {};
  const storeName = String(existing.storeName || user.displayName || email.split('@')[0] || 'My Store').trim();

  const patch = {
    email,
    ownerEmail: email,
    storeName,
    storeSlug: String(existing.storeSlug || slugify(storeName)).trim(),
    status: existing.status || 'online',
    pricingVersion: 'modular-v2',
    startingPackage: PRESET,
    businessWorkflow: 'live_kitchen',
    enabledModules: modulesRecordFromList(LIVE_KITCHEN_MODULES),
    seatCount: 1,
    posLocationCount: 1,
    subscriptionPlan: existing.subscriptionPlan || 'yearly',
    composedProductSource: 'platform',
    subscriptionStatus: 'active',
    subscriptionTier: existing.subscriptionTier || 'starter',
    subscriptionStartedAt: existing.subscriptionStartedAt || now,
    subscriptionEndsAt: existing.subscriptionEndsAt || endsAt.toISOString(),
    nextBillingDate: existing.nextBillingDate || endsAt.toISOString(),
    allowsComposed: true,
    allowsManufacturing: false,
    migrationNotes: `Live Kitchen package granted manually — ${email}`,
    updatedAt: now,
    ...(profileSnap.exists ? {} : { createdAt: now }),
  };

  const preview = {
    email,
    userId,
    write,
    createdProfile: !profileSnap.exists,
    createSeller: !sellerSnap.exists,
    patch,
  };
  console.log(JSON.stringify(preview, null, 2));

  if (!write) {
    console.log('\nPass --write to apply.');
    return;
  }

  const batch = db.batch();
  batch.set(profileRef, patch, { merge: true });
  if (!sellerSnap.exists) {
    batch.set(sellerRef, {
      isSeller: true,
      sellerSince: now,
      role: 'admin',
      userId,
      storeId: userId,
      updatedAt: now,
    }, { merge: true });
  }
  batch.set(usersRef, { email, storeId: userId, role: 'admin', updatedAt: now }, { merge: true });
  await batch.commit();

  console.log(`\n✅ Applied Live Kitchen package to ${email}`);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
