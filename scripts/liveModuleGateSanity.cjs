/**
 * Live prod module-gate sanity (entitlements + API guards).
 *
 * Usage: node scripts/liveModuleGateSanity.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const PROJECT = 'market-flow-7b074';
const API = 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';
const API_KEY = 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U';

const STORES = {
  yMalek: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
  moove: '1HfsBr45XYM5SkaaazWegmyqGpA3',
};

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT });
}

function curlJson(url, { method = 'GET', headers = {}, body } = {}) {
  const args = ['-sS', '--connect-timeout', '20', '-m', '60', '-X', method, url];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json');
    args.push('-d', JSON.stringify(body));
  }
  args.push('-w', '\n__HTTP_CODE__:%{http_code}');
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  const marker = out.lastIndexOf('\n__HTTP_CODE__:');
  return {
    httpCode: Number(out.slice(marker + 15).trim()),
    text: out.slice(0, marker),
    json: (() => {
      try {
        return JSON.parse(out.slice(0, marker));
      } catch {
        return null;
      }
    })(),
  };
}

async function getIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const { httpCode, json } = curlJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', body: { token: customToken, returnSecureToken: true } },
  );
  if (httpCode !== 200 || !json?.idToken) {
    throw new Error(`signInWithCustomToken failed (${httpCode}): ${JSON.stringify(json)}`);
  }
  return json.idToken;
}

// Mirror src/lib/entitlements.ts (legacy + modular-v2, modular flag ON)
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
  return modules;
}

function resolveModules(profile) {
  const tier = profile.subscriptionTier || 'starter';
  const useModular =
    profile.pricingVersion === 'modular-v2' &&
    profile.enabledModules &&
    Object.keys(profile.enabledModules).length > 0;
  if (useModular) {
    const modules = {};
    CORE.forEach((id) => { modules[id] = profile.enabledModules[id] !== false; });
    Object.entries(profile.enabledModules).forEach(([id, on]) => { modules[id] = Boolean(on); });
    return { source: 'modular', modules };
  }
  return { source: 'legacy', modules: legacyModules(tier, profile) };
}

function pass(label, detail) {
  console.log(`[PASS] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function fail(label, detail) {
  console.log(`[FAIL] ${label}`);
  if (detail) console.log(`       ${detail}`);
}

async function main() {
  console.log('=== Live module gate sanity (prod) ===\n');
  let failed = 0;

  const db = admin.firestore();
  const profiles = {};
  for (const [name, id] of Object.entries(STORES)) {
    const snap = await db.collection('storeProfiles').doc(id).get();
    profiles[name] = snap.exists ? snap.data() : null;
  }

  const yEnt = resolveModules(profiles.yMalek || {});
  const mEnt = resolveModules(profiles.moove || {});

  // Entitlement expectations
  if (yEnt.modules.crm) pass('E1 — y.malek CRM entitled (legacy salesCrm add-on)', `source=${yEnt.source}`);
  else { fail('E1 — y.malek CRM entitled', `crm=${yEnt.modules.crm}`); failed++; }

  if (!mEnt.modules.crm) pass('E2 — moove CRM not entitled', `source=${mEnt.source}`);
  else { fail('E2 — moove CRM blocked', `crm=${mEnt.modules.crm}`); failed++; }

  if (!mEnt.modules.pos) pass('E3 — moove POS not entitled');
  else { fail('E3 — moove POS blocked', `pos=${mEnt.modules.pos}`); failed++; }

  if (!mEnt.modules.factory) pass('E4 — moove factory not entitled');
  else { fail('E4 — moove factory blocked', `factory=${mEnt.modules.factory}`); failed++; }

  // API guards (functions ECOSYSTEM_ENFORCE_MODULES)
  const mooveToken = await getIdToken(STORES.moove);
  const yToken = await getIdToken(STORES.yMalek);

  const mooveCrm = curlJson(`${API}/crm/reps/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mooveToken}` },
    body: { storeId: STORES.moove, name: 'x', email: 'gate-test@invalid.local', password: 'x' },
  });
  if (mooveCrm.httpCode === 403) {
    pass('A1 — moove CRM API blocked (403)', `body=${mooveCrm.text}`);
  } else {
    fail('A1 — moove CRM API blocked', `http=${mooveCrm.httpCode} body=${mooveCrm.text}`);
    failed++;
  }

  const yCrm = curlJson(`${API}/crm/reps/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${yToken}` },
    body: { storeId: STORES.yMalek },
  });
  if (yCrm.httpCode !== 403 || !String(yCrm.text).includes('Module not enabled')) {
    pass('A2 — y.malek CRM API passes module gate', `http=${yCrm.httpCode} (not module 403)`);
  } else {
    fail('A2 — y.malek CRM API passes module gate', `body=${yCrm.text}`);
    failed++;
  }

  const moovePos = curlJson(`${API}/pos/pairing-code`, {
    method: 'POST',
    body: { storeId: STORES.moove, uid: STORES.moove },
  });
  if (moovePos.httpCode === 403 && String(moovePos.text).includes('POS module not enabled')) {
    pass('A3 — moove POS pairing blocked (403)', `body=${moovePos.text}`);
  } else {
    fail('A3 — moove POS pairing blocked', `http=${moovePos.httpCode} body=${moovePos.text}`);
    failed++;
  }

  // Hosting bundle flag (pipe through grep — main bundle is ~1MB)
  const html = execFileSync('curl', ['-sS', 'https://grabio.space/'], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (jsMatch) {
    const flagLine = execFileSync(
      'bash',
      ['-lc', `curl -sS 'https://grabio.space${jsMatch[1]}' | grep -o 'VITE_ECOSYSTEM_ENFORCE_MODULES:"[^"]*"' | head -1`],
      { encoding: 'utf8' },
    ).trim();
    if (flagLine === 'VITE_ECOSYSTEM_ENFORCE_MODULES:"true"') {
      pass('H1 — prod hosting bundle has enforce flag ON', `${jsMatch[1]} → ${flagLine}`);
    } else {
      fail('H1 — prod hosting enforce flag', flagLine || 'not found in bundle');
      failed++;
    }
  } else {
    fail('H1 — prod hosting bundle', 'could not find index js');
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
