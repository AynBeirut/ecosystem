/**
 * Manually activate a modular subscription after Whish payment when webhook missed.
 * Usage: node scripts/activateModularPayment.cjs <email> [externalId]
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const email = process.argv[2];
const externalIdArg = process.argv[3];

if (!email) {
  console.error('Usage: node scripts/activateModularPayment.cjs <email> [externalId]');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
const db = admin.firestore();

const CORE = ['invoicing', 'marketplace', 'analytics', 'payments', 'delivery'];
const ALL_MODULE_IDS = [
  ...CORE, 'stock', 'factory', 'restaurant', 'crm', 'team', 'dropship', 'services', 'pos',
  'invoice_manager', 'projects', 'builder', 'ai_builder', 'blog_publisher', 'whitelabel',
  'admin_mobile', 'ai_agent', 'content_creator', 'market_strategy', 'email_marketing',
  'proposal_writer', 'seo_assistant', 'analytics_insights', 'campaign_writer',
];

function modulesRecordFromList(ids) {
  const record = {};
  ALL_MODULE_IDS.forEach((id) => { record[id] = ids.includes(id); });
  return record;
}

function addOnMetaFromKeys(keys) {
  return {
    domainPackage: keys.includes('domainPackage'),
    whatsappBusiness: keys.includes('whatsappBusiness'),
    salesCrm: keys.includes('salesCrm'),
    extraStorageBlocks: keys.includes('extraStorage') ? 1 : 0,
  };
}

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  const userId = user.uid;
  const ref = db.collection('storeProfiles').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('storeProfile missing');

  const data = snap.data();
  const externalId = externalIdArg || data.pendingSubscriptionPaymentId;
  if (!externalId) throw new Error('No externalId — pass as second argument');

  const enabledModuleIds = Array.isArray(data.pendingModularEnabledModules)
    ? data.pendingModularEnabledModules
    : [];
  if (!enabledModuleIds.length) throw new Error('No pendingModularEnabledModules on profile');

  const addOnKeys = Array.isArray(data.pendingModularAddOnKeys) ? data.pendingModularAddOnKeys : [];
  const billing = data.pendingModularBilling === 'yearly' ? 'yearly' : 'monthly';
  const amountCents = Number(data.pendingModularAmount) || 0;
  const presetRaw = String(data.pendingModularPreset || 'custom');

  const endsAt = new Date();
  if (billing === 'yearly') endsAt.setFullYear(endsAt.getFullYear() + 1);
  else endsAt.setMonth(endsAt.getMonth() + 1);

  const addOnMeta = addOnMetaFromKeys(addOnKeys);
  const addOnList = [...new Set(addOnKeys)];

  await ref.set({
    pricingVersion: 'modular-v2',
    startingPackage: presetRaw,
    businessWorkflow: presetRaw === 'pkg_shop' ? 'shop' : 'custom',
    enabledModules: modulesRecordFromList(enabledModuleIds),
    seatCount: Number(data.pendingModularSeats) || 1,
    posLocationCount: Number(data.pendingModularPosLocations) || 0,
    subscriptionPlan: billing,
    composedProductSource: 'platform',
    addOns: addOnList,
    addOnsMeta: addOnMeta,
    subscriptionStatus: 'active',
    subscriptionTier: 'starter',
    subscriptionStartedAt: new Date().toISOString(),
    subscriptionEndsAt: endsAt.toISOString(),
    nextBillingDate: endsAt.toISOString(),
    lastPaymentDate: new Date().toISOString(),
    lastPaymentAmount: amountCents / 100,
    lastModularPurchaseAt: new Date().toISOString(),
    lastModularPurchaseCents: amountCents,
    billingHistory: admin.firestore.FieldValue.arrayUnion({
      date: new Date().toISOString(),
      amount: amountCents / 100,
      plan: billing,
      tier: 'modular-v2',
      status: 'success',
      transactionId: String(externalId),
      description: `Modular ${presetRaw} - ${billing} (manual activation)`,
    }),
    pendingModularPreset: admin.firestore.FieldValue.delete(),
    pendingModularBilling: admin.firestore.FieldValue.delete(),
    pendingModularAmount: admin.firestore.FieldValue.delete(),
    pendingModularSeats: admin.firestore.FieldValue.delete(),
    pendingModularPosLocations: admin.firestore.FieldValue.delete(),
    pendingModularEnabledModules: admin.firestore.FieldValue.delete(),
    pendingModularAddOnKeys: admin.firestore.FieldValue.delete(),
    pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  console.log('✅ Activated modular subscription for', email);
  console.log('   Modules:', enabledModuleIds.join(', '));
  console.log('   Amount: $' + (amountCents / 100));
  console.log('   External ID:', externalId);
}

main().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
