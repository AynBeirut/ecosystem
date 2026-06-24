/**
 * Read-only audit: legacy CRM resolution via legacyModulesForTier() (not raw modulesFromSelection).
 * Usage: node scripts/auditSalesCrmLegacy.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

const TIER_ORDER = ['starter', 'pro', 'business'];
const CORE_MODULE_IDS = ['invoicing', 'marketplace', 'analytics', 'payments', 'delivery'];

function normalizeTier(raw) {
  if (!raw) return 'starter';
  if (raw === 'premium') return 'starter';
  if (raw === 'trial' || raw === 'starter' || raw === 'pro' || raw === 'business') return raw;
  return 'starter';
}

function tierMeetsMinimum(selected, minTier) {
  return TIER_ORDER.indexOf(selected) >= TIER_ORDER.indexOf(minTier);
}

function normalizeAddOnsFromProfile(addOns) {
  if (Array.isArray(addOns)) {
    return {
      domainPackage: addOns.includes('domainPackage') || addOns.includes('customDomainHosting'),
      whatsappBusiness: addOns.includes('whatsappBusiness'),
      salesCrm: addOns.includes('salesCrm'),
      extraStorageBlocks: addOns.includes('extraStorage') || addOns.includes('storage') ? 1 : 0,
    };
  }
  const value = addOns && typeof addOns === 'object' ? addOns : {};
  return {
    domainPackage: Boolean(value.domainPackage),
    whatsappBusiness: Boolean(value.whatsappBusiness),
    salesCrm: Boolean(value.salesCrm),
    extraStorageBlocks: Math.max(0, Number(value.extraStorageBlocks) || 0),
  };
}

/** Mirrors src/lib/pricingDisplay.ts modulesFromSelection (catalog tier grants included). */
function modulesFromSelection(tier, addOns) {
  const modules = {};
  ['invoicing', 'marketplace', 'analytics', 'payments', 'delivery', 'admin_mobile'].forEach((id) => {
    modules[id] = true;
  });
  if (tierMeetsMinimum(tier, 'starter')) {
    modules.crm = true;
    modules.projects = true;
    modules.builder = true;
    modules.ai_builder = true;
    modules.blog_publisher = true;
    modules.pos = true;
    modules.invoice_manager = true;
    modules.content_creator = true;
    modules.market_strategy = true;
    modules.proposal_writer = true;
    modules.seo_assistant = true;
    modules.analytics_insights = true;
    modules.campaign_writer = true;
  }
  if (tierMeetsMinimum(tier, 'pro')) modules.factory = true;
  if (tierMeetsMinimum(tier, 'business')) {
    modules.team = true;
    modules.whitelabel = true;
  }
  modules.domainPackage = addOns.domainPackage;
  modules.whatsappBusiness = addOns.whatsappBusiness;
  modules.extraStorage = addOns.extraStorageBlocks > 0;
  return modules;
}

/** Mirrors src/lib/entitlements.ts legacyModulesForTier() after Option B override. */
function legacyModulesForTier(tier, data) {
  const paidTier = tier === 'trial' ? 'starter' : tier;
  const addOns = normalizeAddOnsFromProfile(data.addOns ?? data.addOnsMeta);
  const modules = modulesFromSelection(paidTier, addOns);

  CORE_MODULE_IDS.forEach((id) => {
    modules[id] = true;
  });
  modules.stock = true;
  modules.dropship = true;
  modules.services = true;
  modules.admin_mobile = true;

  if (tier === 'pro' || tier === 'business') {
    modules.factory = true;
    modules.restaurant = true;
  }

  modules.crm = addOns.salesCrm;

  return modules;
}

function hasSalesCrm(data) {
  const addOns = data.addOns;
  if (Array.isArray(addOns) && addOns.includes('salesCrm')) return true;
  if (data.addOnsMeta?.salesCrm === true) return true;
  if (addOns && typeof addOns === 'object' && !Array.isArray(addOns) && addOns.salesCrm === true) return true;
  return false;
}

function isModular(data) {
  return data.pricingVersion === 'modular-v2' && data.enabledModules && Object.keys(data.enabledModules).length > 0;
}

async function main() {
  const snap = await db.collection('storeProfiles').get();
  const legacyAccounts = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (isModular(data)) continue;
    const tier = normalizeTier(data.subscriptionTier);
    const addOns = normalizeAddOnsFromProfile(data.addOns ?? data.addOnsMeta);
    const modules = legacyModulesForTier(tier, data);
    legacyAccounts.push({
      storeId: doc.id,
      storeName: data.storeName || data.email || doc.id,
      tier,
      salesCrmAddon: hasSalesCrm(data),
      legacyModulesForTier_crm: Boolean(modules.crm),
      addOns_salesCrm: addOns.salesCrm,
    });
  }

  const withAddon = legacyAccounts.filter((r) => r.salesCrmAddon);
  const withoutAddon = legacyAccounts.filter((r) => !r.salesCrmAddon);
  const targetSeven = [...withAddon, ...withoutAddon.filter((r) => r.legacyModulesForTier_crm !== r.salesCrmAddon)].slice(0, 7);

  // Prioritize the known 7 from prior audit: 2 addon + 5 no-addon tier-grant victims
  const knownIds = new Set([
    'Av22LKyet8QmVcu9b8Njz1HVfoy1',
    'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
    '1K94SMqUrHVpiNdxuCwy3arXtbl1',
    'g4c7tzihykZRRGoBv6coGYo0QIz1',
    'p5zesYQXZRRYA3wKUxjfVCqxQQo1',
    'vbWshU8vmobg52zBaiZh0W9iI912',
    'xd6pGIer3RUEdL1vMy5OJQunjAO2',
  ]);
  const seven = legacyAccounts.filter((r) => knownIds.has(r.storeId));

  console.log('\n=== legacyModulesForTier().crm — 7 legacy accounts (2 addon + 5 no-addon) ===\n');
  for (const row of seven.sort((a, b) => Number(b.salesCrmAddon) - Number(a.salesCrmAddon))) {
    console.log(JSON.stringify(row));
  }

  const addonFails = withAddon.filter((r) => !r.legacyModulesForTier_crm);
  const noAddonLeaks = withoutAddon.filter((r) => r.legacyModulesForTier_crm);

  console.log('\n=== Summary (all legacy accounts) ===');
  console.log(`Legacy total: ${legacyAccounts.length}`);
  console.log(`With salesCrm add-on: ${withAddon.length} → legacyModulesForTier().crm should be true: ${withAddon.filter((r) => r.legacyModulesForTier_crm).length}/${withAddon.length}`);
  console.log(`Without salesCrm add-on: ${withoutAddon.length} → legacyModulesForTier().crm should be false: ${withoutAddon.filter((r) => !r.legacyModulesForTier_crm).length}/${withoutAddon.length}`);
  console.log(`Add-on accounts where crm false (FAIL): ${addonFails.length}`);
  console.log(`No-add-on accounts where crm true (FAIL): ${noAddonLeaks.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
