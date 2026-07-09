/**
 * Live prod Builder Phase 2 E2E sanity (Admin SDK + client rules via REST).
 *
 * Flow: auth token → builders/{uid} → demo store → demo product → self-transfer → verify → cleanup
 *
 * Usage: node scripts/liveBuilderPhase2Sanity.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const PROJECT = 'market-flow-7b074';
const API = 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';
const API_KEY = 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U';
const TAG = `builder-p2-${new Date().toISOString().slice(0, 10)}`;
const TEST_UID = `p2sanity${Date.now().toString(36).slice(-8)}`;
const TEST_EMAIL = `${TEST_UID}@builder-sanity.invalid`;

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT });
}
const db = admin.firestore();

const results = [];
let failed = 0;

function pass(id, label, detail) {
  results.push({ id, status: 'PASS', label, detail });
  console.log(`[PASS] ${id} — ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function fail(id, label, detail) {
  failed += 1;
  results.push({ id, status: 'FAIL', label, detail });
  console.log(`[FAIL] ${id} — ${label}`);
  if (detail) console.log(`       ${detail}`);
}

function curlJson(url, { method = 'GET', headers = {}, body } = {}) {
  const args = ['-sS', '--connect-timeout', '20', '-m', '90', '-X', method, url];
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

function docPath(collection, docId) {
  return `projects/${PROJECT}/databases/(default)/documents/${collection}/${docId}`;
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else throw new Error(`unsupported field ${k}`);
  }
  return fields;
}

function firestoreSet(idToken, path, data) {
  const url = `https://firestore.googleapis.com/v1/${path}`;
  return curlJson(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}` },
    body: { fields: toFields(data) },
  });
}

function firestoreDelete(idToken, path) {
  const url = `https://firestore.googleapis.com/v1/${path}`;
  return curlJson(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

async function cleanup(uid, demoId, storeId, productIds) {
  try {
    await db.collection('builders').doc(uid).collection('demoStores').doc(demoId).delete().catch(() => {});
    const demoRef = db.collection('builders').doc(uid).collection('demoStores').doc(demoId);
    const products = await demoRef.collection('products').get();
    for (const p of products.docs) await p.ref.delete().catch(() => {});
    await demoRef.collection('profile').doc('branding').delete().catch(() => {});
    await db.collection('builders').doc(uid).delete().catch(() => {});
    if (storeId) {
      const prods = await db.collection('products').where('storeId', '==', storeId).get();
      for (const p of prods.docs) {
        if (String(p.id).includes(TAG) || String(p.data()?.name || '').includes(TAG)) {
          await p.ref.delete().catch(() => {});
        }
      }
      await db.collection('storeProfiles').doc(storeId).delete().catch(() => {});
    }
    for (const pid of productIds) {
      await db.collection('products').doc(pid).delete().catch(() => {});
    }
    await db.collection('users').doc(uid).delete().catch(() => {});
    await db.collection('sellers').doc(uid).delete().catch(() => {});
    await admin.auth().deleteUser(uid).catch(() => {});
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  }
}

async function main() {
  console.log('=== Live Builder Phase 2 sanity (prod) ===');
  console.log(`Tag: ${TAG}`);
  console.log(`Test UID: ${TEST_UID}\n`);

  // ── Deploy surface checks ──
  const html = execFileSync('curl', ['-sS', 'https://grabio.space/'], { encoding: 'utf8' });
  const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const localHash = (() => {
    try {
      const files = require('fs').readdirSync(join(process.cwd(), 'dist/assets')).filter((f) => f.startsWith('index-') && f.endsWith('.js'));
      return files[0] || 'missing';
    } catch {
      return 'no local dist';
    }
  })();
  const prodJs = jsMatch ? jsMatch[1] : 'not found';
  if (prodJs.includes('index-') && localHash !== 'missing' && prodJs.endsWith(localHash.replace(/^\/assets\//, '').replace(localHash, localHash))) {
    // loose check below
  }
  if (jsMatch) {
    const flags = execFileSync(
      'bash',
      ['-lc', `curl -sS 'https://grabio.space${jsMatch[1]}' | grep -oE 'onboarding/builder|BuilderDemo|builder/demo' | sort -u | tr '\\n' ','`],
      { encoding: 'utf8' },
    ).trim();
    if (flags.includes('onboarding/builder') && flags.includes('BuilderDemo')) {
      pass('D-HOST', 'Prod hosting bundle includes Builder Phase 2 routes', `${prodJs} → ${flags}`);
    } else {
      fail('D-HOST', 'Prod hosting bundle missing builder routes', flags || 'not found');
    }
  } else {
    fail('D-HOST', 'Prod hosting index bundle', 'could not parse grabio.space HTML');
  }

  const onboardingHttp = execFileSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', 'https://grabio.space/onboarding/builder'], { encoding: 'utf8' });
  if (onboardingHttp === '200') {
    pass('D-ROUTE', 'SPA route /onboarding/builder reachable', `HTTP ${onboardingHttp}`);
  } else {
    fail('D-ROUTE', 'SPA route /onboarding/builder', `HTTP ${onboardingHttp}`);
  }

  const apiProbe = curlJson(`${API}/builder/transfer-demo`, { method: 'POST', body: {} });
  if (apiProbe.httpCode === 401) {
    pass('D-API', 'Functions route POST /builder/transfer-demo deployed', `HTTP 401 ${apiProbe.text}`);
  } else {
    fail('D-API', 'Functions route POST /builder/transfer-demo', `HTTP ${apiProbe.httpCode} ${apiProbe.text}`);
  }

  console.log(`       Local dist bundle: ${localHash}`);
  console.log(`       Prod bundle: ${prodJs}\n`);

  let demoId = `${TAG}-demo`;
  let storeId = TEST_UID;
  let transferredProductIds = [];

  try {
    await admin.auth().createUser({ uid: TEST_UID, email: TEST_EMAIL, password: 'SanityTest!234567' });
    pass('B1', 'Test auth user created (signup surrogate)', TEST_UID);
  } catch (e) {
    fail('B1', 'Test auth user created', e.message);
    throw e;
  }

  const idToken = await getIdToken(TEST_UID);
  pass('B1b', 'Custom token → idToken (login surrogate)', `uid=${TEST_UID}`);

  const ts = new Date().toISOString();
  const builderPath = docPath('builders', TEST_UID);
  const builderWrite = firestoreSet(idToken, builderPath, {
    businessType: 'designer',
    demoSlotCount: 2,
    createdAt: ts,
    updatedAt: ts,
  });
  if (builderWrite.httpCode >= 200 && builderWrite.httpCode < 300) {
    pass('B2', 'builders/{uid} create (business type onboarding)', `HTTP ${builderWrite.httpCode}`);
  } else {
    fail('B2', 'builders/{uid} create', `HTTP ${builderWrite.httpCode} ${builderWrite.text}`);
  }

  const demoPath = `${builderPath}/demoStores/${demoId}`;
  const demoWrite = firestoreSet(idToken, demoPath, {
    name: `${TAG} Demo Store`,
    status: 'draft',
    previewTokenHash: '',
    createdAt: ts,
    updatedAt: ts,
  });
  if (demoWrite.httpCode >= 200 && demoWrite.httpCode < 300) {
    pass('B3', 'demoStores/{demoId} create', `HTTP ${demoWrite.httpCode}`);
  } else {
    fail('B3', 'demoStores/{demoId} create', `HTTP ${demoWrite.httpCode} ${demoWrite.text}`);
  }

  const brandingPath = `${demoPath}/profile/branding`;
  const brandingWrite = firestoreSet(idToken, brandingPath, {
    name: `${TAG} Demo Store`,
    slug: `${TAG}-demo`,
    template: 'modern',
    description: 'Phase 2 sanity demo',
    slogan: 'Sanity test',
  });
  if (brandingWrite.httpCode >= 200 && brandingWrite.httpCode < 300) {
    pass('B3b', 'demo branding profile create', `HTTP ${brandingWrite.httpCode}`);
  } else {
    fail('B3b', 'demo branding profile create', `HTTP ${brandingWrite.httpCode} ${brandingWrite.text}`);
  }

  const demoProductPath = `${demoPath}/products/${TAG}-product`;
  const productWrite = firestoreSet(idToken, demoProductPath, {
    name: `${TAG} Product`,
    description: 'sanity',
    price: 12.99,
    category: 'General',
    createdAt: ts,
  });
  if (productWrite.httpCode >= 200 && productWrite.httpCode < 300) {
    pass('B4', 'demo product create under builder path', `HTTP ${productWrite.httpCode}`);
  } else {
    fail('B4', 'demo product create', `HTTP ${productWrite.httpCode} ${productWrite.text}`);
  }

  const storePath = docPath('storeProfiles', storeId);
  const storeWrite = firestoreSet(idToken, storePath, {
    id: storeId,
    storeId,
    ownerId: TEST_UID,
    email: TEST_EMAIL,
    name: `${TAG} Demo Store`,
    slug: `${TAG}-store`,
    description: 'Transferred from demo',
    template: 'modern',
    isDemo: false,
    subscriptionStatus: 'trial',
    subscriptionTier: 'trial',
    status: 'active',
    transferredFromDemoId: demoId,
    transferredFromBuilderUid: TEST_UID,
    createdAt: ts,
    updatedAt: ts,
  });
  if (storeWrite.httpCode >= 200 && storeWrite.httpCode < 300) {
    pass('B5', 'Self-transfer: storeProfiles/{uid} create (rules)', `HTTP ${storeWrite.httpCode}`);
  } else {
    fail('B5', 'Self-transfer: storeProfiles create', `HTTP ${storeWrite.httpCode} ${storeWrite.text}`);
  }

  const liveProductPath = docPath('products', `${TAG}-live-product`);
  const liveProductWrite = firestoreSet(idToken, liveProductPath, {
    name: `${TAG} Live Product`,
    description: 'copied on transfer',
    price: 12.99,
    category: 'General',
    storeId,
    inStock: true,
    stock: 10,
    deliveryTime: '1-3 days',
    productType: 'simple',
    createdAt: ts,
    updatedAt: ts,
  });
  if (liveProductWrite.httpCode === 403) {
    fail('B6', 'Top-level products blocked until trial store is commerce-eligible', `HTTP 403 (trial may need subscription fields on prod rules)`);
  } else if (liveProductWrite.httpCode >= 200 && liveProductWrite.httpCode < 300) {
    transferredProductIds.push(`${TAG}-live-product`);
    pass('B6', 'Transfer copy: products/{id} create for real store', `HTTP ${liveProductWrite.httpCode}`);
  } else {
    fail('B6', 'Transfer copy: products create', `HTTP ${liveProductWrite.httpCode} ${liveProductWrite.text}`);
  }

  const demoUpdate = firestoreSet(idToken, demoPath, {
    status: 'converted',
    transferredStoreId: storeId,
    convertedAt: ts,
    updatedAt: ts,
  });
  if (demoUpdate.httpCode >= 200 && demoUpdate.httpCode < 300) {
    pass('B7', 'Demo marked converted after transfer', `HTTP ${demoUpdate.httpCode}`);
  } else {
    fail('B7', 'Demo marked converted', `HTTP ${demoUpdate.httpCode} ${demoUpdate.text}`);
  }

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  const demoSnap = await db.collection('builders').doc(TEST_UID).collection('demoStores').doc(demoId).get();
  if (storeSnap.exists && storeSnap.data()?.transferredFromDemoId === demoId) {
    pass('B8', 'Firestore verify: real store exists with demo link', `storeId=${storeId}`);
  } else {
    fail('B8', 'Firestore verify: real store', storeSnap.exists ? 'missing link fields' : 'doc missing');
  }
  if (demoSnap.exists && demoSnap.data()?.status === 'converted') {
    pass('B9', 'Firestore verify: demo status converted', demoId);
  } else {
    fail('B9', 'Firestore verify: demo status', demoSnap.data()?.status || 'missing');
  }

  const strangerUid = '1HfsBr45XYM5SkaaazWegmyqGpA3';
  const strangerToken = await getIdToken(strangerUid);
  const strangerWrite = firestoreSet(strangerToken, demoPath, { name: 'hack', status: 'draft', updatedAt: ts });
  if (strangerWrite.httpCode === 403 || strangerWrite.httpCode === 401) {
    pass('B10', 'Stranger cannot write another builder demo path', `HTTP ${strangerWrite.httpCode}`);
  } else {
    fail('B10', 'Stranger blocked on builder demo', `HTTP ${strangerWrite.httpCode} ${strangerWrite.text}`);
  }

  console.log('\n--- Cleanup ---');
  await cleanup(TEST_UID, demoId, storeId, transferredProductIds);
  console.log('Cleanup done.\n');

  console.log(failed === 0 ? 'ALL PASS' : `${failed} FAILED`);
  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`${r.status} ${r.id} ${r.label}${r.detail ? ` | ${r.detail}` : ''}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
