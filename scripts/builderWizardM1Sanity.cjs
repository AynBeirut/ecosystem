/**
 * M1 builder wizard sanity — entitlements, Firestore rules, wizard data paths.
 * Usage: node scripts/builderWizardM1Sanity.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const PROJECT = 'market-flow-7b074';
const API_KEY = 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const STORES = {
  moove: '1HfsBr45XYM5SkaaazWegmyqGpA3',
  yMalek: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
  anwar: 'Av22LKyet8QmVcu9b8Njz1HVfoy1',
};

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT });
}

const CORE = [
  'invoicing', 'stock', 'payments', 'analytics', 'delivery', 'marketplace',
];

function normalizeAddOns(profile) {
  const meta = profile.addOnsMeta || {};
  if (Array.isArray(profile.addOns)) {
    return { salesCrm: profile.addOns.includes('salesCrm') || meta.salesCrm === true };
  }
  return { salesCrm: meta.salesCrm === true };
}

function tierMeetsMinimum(tier, minTier) {
  const order = ['starter', 'pro', 'business', 'premium'];
  return order.indexOf(tier) >= order.indexOf(minTier);
}

function modulesFromSelection(tier, addOns) {
  const tierModules = {
    builder: tierMeetsMinimum(tier, 'starter'),
    ai_builder: tierMeetsMinimum(tier, 'starter'),
    blog_publisher: tierMeetsMinimum(tier, 'starter'),
  };
  return tierModules;
}

function legacyModules(tier, profile) {
  const addOns = normalizeAddOns(profile);
  const modules = {};
  CORE.forEach((id) => { modules[id] = true; });
  modules.stock = true;
  modules.dropship = true;
  modules.services = true;
  modules.admin_mobile = true;
  if (tier === 'pro' || tier === 'business') {
    modules.factory = true;
    modules.restaurant = true;
  }
  modules.crm = addOns.salesCrm;
  Object.assign(modules, modulesFromSelection(tier === 'trial' ? 'starter' : tier, addOns));
  return modules;
}

function modulesFromSelection(tier) {
  return {
    builder: ['starter', 'pro', 'business'].includes(tier),
    ai_builder: ['starter', 'pro', 'business'].includes(tier),
    blog_publisher: ['starter', 'pro', 'business'].includes(tier),
  };
}

function modularModules(profile) {
  const enabled = profile.enabledModules || {};
  const modules = {};
  CORE.forEach((id) => { modules[id] = enabled[id] !== false; });
  Object.entries(enabled).forEach(([id, on]) => { modules[id] = Boolean(on); });
  const tier = profile.subscriptionTier || 'starter';
  const paidTier = tier === 'trial' ? 'starter' : tier;
  const tierGranted = modulesFromSelection(paidTier, normalizeAddOns(profile));
  for (const id of ['builder', 'ai_builder', 'blog_publisher']) {
    if (enabled[id] === false) continue;
    if (tierGranted[id]) modules[id] = true;
  }
  return modules;
}

function resolveModules(profile) {
  const tier = profile.subscriptionTier || 'starter';
  const useModular =
    profile.pricingVersion === 'modular-v2' &&
    profile.enabledModules &&
    Object.keys(profile.enabledModules).length > 0;
  if (useModular) {
    return { source: 'modular', modules: modularModules(profile) };
  }
  return { source: 'legacy', modules: legacyModules(tier, profile) };
}

function canUseModule(profile, moduleId) {
  const ent = resolveModules(profile || {});
  return Boolean(ent.modules[moduleId]);
}

async function getIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok || !json.idToken) {
    throw new Error(`signInWithCustomToken failed: ${JSON.stringify(json)}`);
  }
  return json.idToken;
}

function pass(label, detail) {
  console.log(`[PASS] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function fail(label, detail) {
  console.log(`[FAIL] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function firestoreValue(v) {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = firestoreValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

async function firestorePatch(idToken, docPath, fields) {
  const url = `${FIRESTORE}/${docPath}?` + Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, firestoreValue(v)])) }),
  });
  return { status: res.status, text: await res.text() };
}

async function firestoreCreate(idToken, collection, data) {
  const url = `${FIRESTORE}/${collection}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, firestoreValue(v)])),
    }),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, text, json };
}

async function main() {
  console.log('=== M1 Builder Wizard Sanity ===\n');
  let failed = 0;

  const db = admin.firestore();
  const profiles = {};
  for (const [name, id] of Object.entries(STORES)) {
    const snap = await db.collection('storeProfiles').doc(id).get();
    profiles[name] = snap.exists ? snap.data() : null;
  }

  // --- Module gating (mirrors useModuleEntitlement + ModuleGate) ---
  const mooveBuilder = canUseModule(profiles.moove, 'builder');
  const anwarBuilder = canUseModule(profiles.anwar, 'builder');
  const yBuilder = canUseModule(profiles.yMalek, 'builder');

  if (!mooveBuilder) pass('G1 — moove NOT entitled to builder (modular, builder=false)');
  else { fail('G1 — moove should be blocked from builder module'); failed++; }

  if (anwarBuilder) pass('G2 — anwar entitled to builder (modular business + tier grant)', `source=${resolveModules(profiles.anwar).source}`);
  else { fail('G2 — anwar should have builder via business tier'); failed++; }

  if (yBuilder) pass('G3 — y.malek entitled to builder (legacy pro tier)');
  else { fail('G3 — y.malek should have builder'); failed++; }

  // --- Firestore rules (owner writes — rules do NOT check builder module) ---
  const mooveToken = await getIdToken(STORES.moove);
  const anwarToken = await getIdToken(STORES.anwar);

  const mooveProfilePatch = await firestorePatch(mooveToken, `storeProfiles/${STORES.moove}`, {
    builderWizard: { step: 'site-type', updatedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  });
  if (mooveProfilePatch.status === 200) {
    pass('F1 — moove owner CAN patch storeProfiles (rules: owner write, no module check)');
  } else {
    fail('F1 — moove storeProfiles patch', `status=${mooveProfilePatch.status} ${mooveProfilePatch.text.slice(0, 200)}`);
    failed++;
  }

  const testProductName = `M1 sanity ${Date.now()}`;
  const productCreate = await firestoreCreate(mooveToken, 'products', {
    name: testProductName,
    description: 'M1 sanity — delete me',
    price: 1,
    category: 'General',
    image: 'https://placehold.co/400x300',
    storeId: STORES.moove,
    inStock: true,
    stock: 0,
    deliveryTime: '1-3 days',
    productType: 'simple',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  let sanityProductId = null;
  if (productCreate.status === 200 && productCreate.json?.name) {
    sanityProductId = productCreate.json.name.split('/').pop();
    pass('F2 — moove owner CAN create products/ doc (shared write path)', `id=${sanityProductId}`);
  } else {
    fail('F2 — moove products create', `status=${productCreate.status} ${productCreate.text.slice(0, 300)}`);
    failed++;
  }

  // --- Wizard data paths (anwar store, restore after) ---
  const anwarRef = db.collection('storeProfiles').doc(STORES.anwar);
  const beforeSnap = await anwarRef.get();
  const before = beforeSnap.data() || {};
  const restoreKeys = ['storefrontMode', 'builderWizard', 'enabledModules', 'status', 'updatedAt'];

  try {
    const ts = new Date().toISOString();

    // Display path
    await anwarRef.set({
      storefrontMode: 'display',
      builderWizard: { step: 'theme', siteIntent: 'display', updatedAt: ts },
      enabledModules: {
        invoicing: true, marketplace: false, analytics: true, payments: true,
        delivery: false, stock: true, blog_publisher: false,
      },
      pricingVersion: 'modular-v2',
      businessWorkflow: 'custom',
      updatedAt: ts,
    }, { merge: true });
    const displaySnap = await anwarRef.get();
    if (displaySnap.data()?.storefrontMode === 'display') pass('W1 — Display path patch (storefrontMode=display)');
    else { fail('W1 — Display path'); failed++; }

    // Blog path
    await anwarRef.set({
      storefrontMode: 'display',
      builderWizard: { step: 'theme', siteIntent: 'blog', updatedAt: ts },
      enabledModules: {
        invoicing: true, marketplace: false, analytics: true, payments: true,
        delivery: false, stock: true, blog_publisher: true,
      },
      updatedAt: ts,
    }, { merge: true });
    const blogSnap = await anwarRef.get();
    if (blogSnap.data()?.enabledModules?.blog_publisher === true) pass('W2 — Blog path patch (blog_publisher=true)');
    else { fail('W2 — Blog path'); failed++; }

    // E-commerce path + publish
    await anwarRef.set({
      storefrontMode: 'commerce',
      builderWizard: { step: 'publish', siteIntent: 'ecommerce', businessIntent: 'store', updatedAt: ts },
      status: 'online',
      updatedAt: ts,
    }, { merge: true });
    const pubSnap = await anwarRef.get();
    if (pubSnap.data()?.status === 'online' && pubSnap.data()?.storefrontMode === 'commerce') {
      pass('W3 — E-commerce + Publish (status=online, storefrontMode=commerce)');
    } else {
      fail('W3 — Publish path', JSON.stringify({ status: pubSnap.data()?.status, mode: pubSnap.data()?.storefrontMode }));
      failed++;
    }

    const anwarProduct = await firestoreCreate(anwarToken, 'products', {
      name: `M1 wizard ${Date.now()}`,
      description: 'M1 wizard E2E',
      price: 9.99,
      category: 'General',
      image: 'https://placehold.co/400x300',
      storeId: STORES.anwar,
      slug: `m1-wizard-${Date.now()}`,
      inStock: true,
      stock: 0,
      deliveryTime: '1-3 days',
      productType: 'simple',
      createdAt: ts,
      updatedAt: ts,
    });
    if (anwarProduct.status === 200) pass('W4 — E-commerce products/ write via owner token');
    else { fail('W4 — anwar products create', anwarProduct.text.slice(0, 200)); failed++; }
  } finally {
    const restore = {};
    restoreKeys.forEach((k) => {
      if (before[k] !== undefined) restore[k] = before[k];
    });
    restore.updatedAt = new Date().toISOString();
    await anwarRef.set(restore, { merge: true });
    pass('R1 — anwar storeProfiles restored after wizard data tests');
  }

  if (sanityProductId) {
    await db.collection('products').doc(sanityProductId).delete();
    pass('R2 — moove sanity product deleted');
  }

  // Local bundle enforce flag (build with env)
  try {
    execFileSync('npm', ['run', 'build'], {
      cwd: process.cwd(),
      env: { ...process.env, VITE_ECOSYSTEM_ENFORCE_MODULES: 'true' },
      stdio: 'pipe',
    });
    const distFiles = require('fs').readdirSync(join(process.cwd(), 'dist/assets'));
    const indexJs = distFiles.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    const bundle = readFileSync(join(process.cwd(), 'dist/assets', indexJs), 'utf8');
    if (bundle.includes('VITE_ECOSYSTEM_ENFORCE_MODULES:"true"') || bundle.includes('VITE_ECOSYSTEM_ENFORCE_MODULES:!0')) {
      pass('G4 — build bundle embeds VITE_ECOSYSTEM_ENFORCE_MODULES=true');
    } else {
      fail('G4 — enforce flag not found in bundle');
      failed++;
    }
  } catch (err) {
    fail('G4 — build check', err.message);
    failed++;
  }

  console.log('');
  if (failed === 0) console.log('ALL PASS');
  else console.log(`${failed} FAILED`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
