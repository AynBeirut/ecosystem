/**
 * Live prod Phase 1 rules sanity (client SDK rules enforced via REST + user idToken).
 * Plans A–E from builder Phase 1 deploy checklist.
 *
 * Uses curl for Auth REST (Node fetch intermittently ETIMEDOUT to identitytoolkit).
 *
 * Usage: node scripts/liveBuilderPhase1Sanity.cjs
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const STORES = {
  indigo: '6UOoq0Tn8xhGUqBk5o0JMMKsgNN2',
  goGrow: 'p5zesYQXZRRYA3wKUxjfVCqxQQo1',
  nipco: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
  sweetseriaBlocked: '1K94SMqUrHVpiNdxuCwy3arXtbl1',
};

const TAG = `rules-sanity-${new Date().toISOString().slice(0, 10)}`;
const PROJECT = 'market-flow-7b074';
const API_KEY = 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U';

const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: PROJECT });
}

function curlJson(url, { method = 'GET', headers = {}, body } = {}) {
  const args = ['-sS', '--connect-timeout', '20', '-m', '60', '-X', method, url];
  for (const [k, v] of Object.entries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json');
    args.push('-d', JSON.stringify(body));
  }
  args.push('-w', '\n__HTTP_CODE__:%{http_code}');
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  const marker = out.lastIndexOf('\n__HTTP_CODE__:');
  const httpCode = Number(out.slice(marker + 15).trim());
  const text = out.slice(0, marker);
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { httpCode, json, text };
}

async function getIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`;
  const { httpCode, json } = curlJson(url, {
    method: 'POST',
    body: { token: customToken, returnSecureToken: true },
  });
  if (httpCode !== 200 || !json?.idToken) {
    throw new Error(`signInWithCustomToken failed (${httpCode}): ${JSON.stringify(json)}`);
  }
  return json.idToken;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else throw new Error(`unsupported field type for ${k}`);
  }
  return fields;
}

function docPath(collection, docId) {
  return `projects/${PROJECT}/databases/(default)/documents/${collection}/${docId}`;
}

function firestoreCreate(idToken, collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/${docPath(collection, docId)}`;
  return curlJson(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}` },
    body: { fields: toFirestoreFields(data) },
  });
}

function firestoreDelete(idToken, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/${docPath(collection, docId)}`;
  return curlJson(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

function isPermissionDenied(result) {
  const msg = JSON.stringify(result.json || result.text || '');
  return result.httpCode === 403 || /PERMISSION_DENIED|Missing or insufficient permissions/i.test(msg);
}

async function runCase(id, label, fn) {
  try {
    const evidence = await fn();
    return { id, label, pass: true, evidence };
  } catch (err) {
    return { id, label, pass: false, evidence: err?.message || String(err) };
  }
}

async function main() {
  console.log('=== Live Builder Phase 1 sanity (prod) ===');
  console.log(`Tag: ${TAG}\n`);

  const cases = [];

  cases.push(
    await runCase('A', 'Go Grow legacy product create + cleanup', async () => {
      const idToken = await getIdToken(STORES.goGrow);
      const docId = `${TAG}-gogrow-product`;
      const create = firestoreCreate(idToken, 'products', docId, {
        storeId: STORES.goGrow,
        name: 'Rules sanity — delete me',
        price: 1,
      });
      if (create.httpCode !== 200) {
        throw new Error(`create failed (${create.httpCode}): ${create.text}`);
      }
      const del = firestoreDelete(idToken, 'products', docId);
      if (del.httpCode !== 200) {
        throw new Error(`delete failed (${del.httpCode}): ${del.text}`);
      }
      return `set+delete products/${docId} as uid=${STORES.goGrow} → OK`;
    })
  );

  cases.push(
    await runCase('B', 'Indigo active product create + cleanup', async () => {
      const idToken = await getIdToken(STORES.indigo);
      const docId = `${TAG}-indigo-product`;
      const create = firestoreCreate(idToken, 'products', docId, {
        storeId: STORES.indigo,
        name: 'Rules sanity — delete me',
        price: 1,
      });
      if (create.httpCode !== 200) {
        throw new Error(`create failed (${create.httpCode}): ${create.text}`);
      }
      const del = firestoreDelete(idToken, 'products', docId);
      if (del.httpCode !== 200) {
        throw new Error(`delete failed (${del.httpCode}): ${del.text}`);
      }
      return `set+delete products/${docId} as uid=${STORES.indigo} → OK`;
    })
  );

  cases.push(
    await runCase('C', 'Indigo active customer create + cleanup', async () => {
      const idToken = await getIdToken(STORES.indigo);
      const docId = `${TAG}-indigo-customer`;
      const create = firestoreCreate(idToken, 'customers', docId, {
        storeId: STORES.indigo,
        name: 'Rules sanity customer',
      });
      if (create.httpCode !== 200) {
        throw new Error(`create failed (${create.httpCode}): ${create.text}`);
      }
      const del = firestoreDelete(idToken, 'customers', docId);
      if (del.httpCode !== 200) {
        throw new Error(`delete failed (${del.httpCode}): ${del.text}`);
      }
      return `set+delete customers/${docId} as uid=${STORES.indigo} → OK`;
    })
  );

  cases.push(
    await runCase('D', 'Sweetseria blocked product create denied', async () => {
      const idToken = await getIdToken(STORES.sweetseriaBlocked);
      const create = firestoreCreate(idToken, 'products', `${TAG}-sweetseria-product`, {
        storeId: STORES.sweetseriaBlocked,
        name: 'Should fail',
        price: 1,
      });
      if (!isPermissionDenied(create)) {
        throw new Error(`expected permission-denied but got (${create.httpCode}): ${create.text}`);
      }
      return `product create as blocked uid=${STORES.sweetseriaBlocked} → permission-denied (expected)`;
    })
  );

  cases.push(
    await runCase('E', 'Indigo cross-tenant customer on Nipco denied', async () => {
      const idToken = await getIdToken(STORES.indigo);
      const create = firestoreCreate(idToken, 'customers', `${TAG}-cross-tenant`, {
        storeId: STORES.nipco,
        name: 'Cross tenant attempt',
      });
      if (!isPermissionDenied(create)) {
        throw new Error(`expected permission-denied but got (${create.httpCode}): ${create.text}`);
      }
      return `customer create storeId=${STORES.nipco} as uid=${STORES.indigo} → permission-denied (expected)`;
    })
  );

  let failed = 0;
  for (const c of cases) {
    const status = c.pass ? 'PASS' : 'FAIL';
    if (!c.pass) failed += 1;
    console.log(`[${status}] ${c.id} — ${c.label}`);
    console.log(`       ${c.evidence}\n`);
  }

  console.log(failed === 0 ? 'ALL PASS (A–E)' : `${failed} FAILED`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
