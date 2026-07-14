/**
 * Grant mooveelectro@gmail.com the Live Kitchen (resto) modular package.
 *
 * Usage:
 *   node scripts/provisionMooveElectroRestoPackage.cjs          # dry-run preview
 *   node scripts/provisionMooveElectroRestoPackage.cjs --write   # apply to Firestore
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const EMAIL = 'mooveelectro@gmail.com';
const USER_ID = '1HfsBr45XYM5SkaaazWegmyqGpA3';
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
  'invoicing',
  'marketplace',
  'analytics',
  'payments',
  'delivery',
  'stock',
  'factory',
  'restaurant',
  'crm',
  'team',
  'dropship',
  'services',
  'pos',
  'invoice_manager',
  'projects',
  'builder',
  'ai_builder',
  'blog_publisher',
  'whitelabel',
  'admin_mobile',
  'ai_agent',
  'content_creator',
  'market_strategy',
  'email_marketing',
  'proposal_writer',
  'seo_assistant',
  'analytics_insights',
  'campaign_writer',
];

function modulesRecordFromList(ids) {
  const record = {};
  ALL_MODULE_IDS.forEach((id) => {
    record[id] = ids.includes(id);
  });
  return record;
}

const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json not found in project root.');
  console.error('   Download from Firebase Console → Project Settings → Service Accounts.');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function main() {
  const write = process.argv.includes('--write');
  const user = await admin.auth().getUserByEmail(EMAIL);
  if (user.uid !== USER_ID) {
    throw new Error(`UID mismatch: expected ${USER_ID}, got ${user.uid}`);
  }

  const ref = db.collection('storeProfiles').doc(USER_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`storeProfiles/${USER_ID} not found`);
  }

  const existing = snap.data() || {};
  const subscriptionEndsAt =
    existing.legacyExpiresAt ||
    existing.subscriptionEndsAt ||
    new Date('2027-02-28T23:59:59Z').toISOString();

  const patch = {
    pricingVersion: 'modular-v2',
    startingPackage: PRESET,
    businessWorkflow: 'live_kitchen',
    enabledModules: modulesRecordFromList(LIVE_KITCHEN_MODULES),
    seatCount: 1,
    posLocationCount: 1,
    subscriptionPlan: existing.subscriptionPlan || 'yearly',
    composedProductSource: 'platform',
    subscriptionStatus: 'active',
    subscriptionTier: existing.subscriptionTier || 'pro',
    subscriptionEndsAt,
    nextBillingDate: subscriptionEndsAt,
    allowsComposed: true,
    allowsManufacturing: false,
    migrationNotes: 'Live Kitchen (resto) package granted manually — mooveelectro@gmail.com',
    updatedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify({ email: EMAIL, userId: USER_ID, write, patch }, null, 2));

  if (!write) {
    console.log('\nPass --write to apply this Live Kitchen package.');
    return;
  }

  await ref.set(patch, { merge: true });
  console.log(`\n✅ Applied Live Kitchen package to ${EMAIL}`);
  console.log('   Modules:', LIVE_KITCHEN_MODULES.join(', '));
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
