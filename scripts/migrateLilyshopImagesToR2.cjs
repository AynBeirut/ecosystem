#!/usr/bin/env node
/**
 * Migrate lilyshop product images from Firebase Storage -> Cloudflare R2.
 *
 * Read-only by default (discovery). Pass --commit to actually upload + update docs.
 * Old Firebase Storage files are NOT deleted (safety net).
 *
 * Store resolution: --store <storeId>  OR  --name <substring> (default: "lily").
 *
 * R2 creds via env (or falls back to functions/.env for non-secret config):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 *
 * Usage:
 *   node scripts/migrateLilyshopImagesToR2.cjs                 # dry-run discovery
 *   node scripts/migrateLilyshopImagesToR2.cjs --commit        # perform migration
 */
const admin = require('firebase-admin');
const path = require('path');
const crypto = require('crypto');

// ---- args ----
const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
function argVal(flag, def) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const STORE_ID_ARG = argVal('--store', null);
const NAME_SUBSTR = (argVal('--name', 'lily') || '').toLowerCase();

// ---- R2 config ----
const R2 = {
  accountId: process.env.R2_ACCOUNT_ID || '2bef47f1314ea95fae3b30004f203d4c',
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET || 'grabio-media',
};
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://pub-2221e2fa2e024e92b1f253e9fc7887c4.r2.dev').replace(/\/$/, '');

// ---- SigV4 presign (mirrors functions/src/lib/r2Presign.ts) ----
function rfc3986Encode(v) {
  return encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
function encodeKey(key) {
  return key.split('/').map(rfc3986Encode).join('/');
}
function sha256Hex(d) { return crypto.createHash('sha256').update(d, 'utf8').digest('hex'); }
function hmac(key, data) { return crypto.createHmac('sha256', key).update(data, 'utf8').digest(); }
function presignPutUrl(config, key, expiresSeconds = 300) {
  const region = 'auto';
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalUri = `/${encodeKey(config.bucket)}/${encodeKey(key)}`;
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQuery = Object.keys(q).sort().map((k) => `${rfc3986Encode(k)}=${rfc3986Encode(q[k])}`).join('&');
  const canonicalRequest = ['PUT', canonicalUri, canonicalQuery, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  return `${endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
function sanitizeFileName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

// ---- helpers ----
function isFirebaseStorage(url) {
  return typeof url === 'string' && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com'));
}
function isR2(url) {
  return typeof url === 'string' && (url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com') || url.includes('media.grabio'));
}
const EXT_BY_CT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
};
function fileNameFromFirebaseUrl(url, contentType) {
  try {
    const u = new URL(url);
    // Firebase path is /v0/b/<bucket>/o/<ENCODED PATH>?...
    const m = u.pathname.match(/\/o\/(.+)$/);
    let name = 'image';
    if (m) {
      const decoded = decodeURIComponent(m[1]);
      name = decoded.split('/').pop() || 'image';
    }
    // If no extension, add one from content-type.
    if (!/\.[a-zA-Z0-9]{2,5}$/.test(name)) {
      const ext = EXT_BY_CT[contentType] || 'jpg';
      name = `${name}.${ext}`;
    }
    return name;
  } catch {
    return `image.${EXT_BY_CT[contentType] || 'jpg'}`;
  }
}

// ---- init firebase admin ----
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function resolveStore() {
  if (STORE_ID_ARG) {
    const snap = await db.collection('storeProfiles').doc(STORE_ID_ARG).get();
    return [{ id: STORE_ID_ARG, name: snap.exists ? (snap.data().storeName || snap.data().name || '') : '(no profile)' }];
  }
  const all = await db.collection('storeProfiles').get();
  const matches = [];
  all.forEach((doc) => {
    const d = doc.data();
    const name = String(d.storeName || d.name || d.displayName || '').toLowerCase();
    const slug = String(d.slug || d.subdomain || '').toLowerCase();
    if (name.includes(NAME_SUBSTR) || slug.includes(NAME_SUBSTR)) {
      matches.push({ id: doc.id, name: d.storeName || d.name || d.displayName || '', slug: d.slug || d.subdomain || '' });
    }
  });
  return matches;
}

async function collectProducts(storeId) {
  const snap = await db.collection('products').where('storeId', '==', storeId).get();
  const items = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const fields = [];
    if (isFirebaseStorage(d.image)) fields.push({ field: 'image', url: d.image });
    if (isFirebaseStorage(d.imageUrl)) fields.push({ field: 'imageUrl', url: d.imageUrl });
    if (Array.isArray(d.images)) {
      d.images.forEach((u, idx) => { if (isFirebaseStorage(u)) fields.push({ field: `images[${idx}]`, url: u, arrIdx: idx }); });
    }
    items.push({
      id: doc.id,
      name: d.name || '',
      image: d.image || null,
      imageUrl: d.imageUrl || null,
      images: Array.isArray(d.images) ? d.images : null,
      fbFields: fields,
    });
  });
  return items;
}

async function migrateOne(storeId, product) {
  const results = [];
  for (const f of product.fbFields) {
    const res = await fetch(f.url);
    if (!res.ok) { results.push({ field: f.field, ok: false, error: `download ${res.status}` }); continue; }
    let contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!EXT_BY_CT[contentType]) contentType = 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());

    const safeName = sanitizeFileName(fileNameFromFirebaseUrl(f.url, contentType));
    const key = `products/${storeId}/${Date.now()}_${safeName}`;
    const uploadUrl = presignPutUrl(R2, key);
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buf });
    if (!put.ok) { results.push({ field: f.field, ok: false, error: `PUT ${put.status} ${await put.text()}` }); continue; }

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    // verify public GET (retry for propagation)
    let getOk = false;
    for (let a = 0; a < 5; a++) {
      const g = await fetch(publicUrl);
      if (g.ok) { getOk = true; break; }
      await new Promise((r) => setTimeout(r, 800));
    }
    results.push({ field: f.field, ok: getOk, bytes: buf.length, contentType, oldUrl: f.url, newUrl: publicUrl, arrIdx: f.arrIdx, verified: getOk });
  }
  return results;
}

async function main() {
  console.log(`=== lilyshop image migration (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===\n`);
  if (COMMIT && (!R2.accessKeyId || !R2.secretAccessKey)) {
    throw new Error('Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY env for --commit');
  }

  const stores = await resolveStore();
  if (stores.length === 0) { console.log('No store matched.'); return; }
  if (stores.length > 1) {
    console.log('Multiple stores matched — re-run with --store <id>:');
    console.log(JSON.stringify(stores, null, 2));
    return;
  }
  const store = stores[0];
  console.log(`Store: ${store.name} (${store.id})${store.slug ? ' slug=' + store.slug : ''}\n`);

  const products = await collectProducts(store.id);
  const withFb = products.filter((p) => p.fbFields.length > 0);
  const totalFbImages = withFb.reduce((n, p) => n + p.fbFields.length, 0);
  const alreadyR2 = products.filter((p) => isR2(p.image)).length;

  console.log(`Products total: ${products.length}`);
  console.log(`Already on R2 (image field): ${alreadyR2}`);
  console.log(`Products with Firebase Storage images: ${withFb.length}`);
  console.log(`Total Firebase Storage image URLs to migrate: ${totalFbImages}\n`);

  if (!COMMIT) {
    console.log('--- Sample (first 5) ---');
    withFb.slice(0, 5).forEach((p) => {
      console.log(`• ${p.name} [${p.id}]`);
      p.fbFields.forEach((f) => console.log(`    ${f.field}: ${f.url.slice(0, 110)}...`));
    });
    console.log('\nDry run only. Re-run with --commit to migrate.');
    return;
  }

  const migrated = [];
  const failures = [];
  for (const p of withFb) {
    try {
      const results = await migrateOne(store.id, p);
      const allOk = results.length > 0 && results.every((r) => r.ok);
      if (!allOk) {
        failures.push({ id: p.id, name: p.name, results });
        console.log(`✗ ${p.name} [${p.id}] — one or more fields failed`);
        continue;
      }
      // Build doc update
      const update = {};
      const docSnap = await db.collection('products').doc(p.id).get();
      const data = docSnap.data() || {};
      for (const r of results) {
        if (r.field === 'image') update.image = r.newUrl;
        else if (r.field === 'imageUrl') update.imageUrl = r.newUrl;
        else if (r.field.startsWith('images[')) {
          const arr = Array.isArray(update.images) ? update.images : (Array.isArray(data.images) ? [...data.images] : []);
          arr[r.arrIdx] = r.newUrl;
          update.images = arr;
        }
      }
      update.imageMigratedToR2At = new Date().toISOString();
      await db.collection('products').doc(p.id).update(update);
      migrated.push({ id: p.id, name: p.name, results });
      console.log(`✓ ${p.name} [${p.id}] → ${results.map((r) => r.field).join(', ')}`);
    } catch (e) {
      failures.push({ id: p.id, name: p.name, error: e.message });
      console.log(`✗ ${p.name} [${p.id}] — ${e.message}`);
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Migrated products: ${migrated.length}`);
  console.log(`Failed products: ${failures.length}`);
  console.log('\n--- Before/After samples (first 5) ---');
  migrated.slice(0, 5).forEach((m) => {
    m.results.forEach((r) => {
      console.log(`• ${m.name} [${r.field}]`);
      console.log(`    OLD: ${r.oldUrl.slice(0, 100)}...`);
      console.log(`    NEW: ${r.newUrl}`);
    });
  });
  if (failures.length) {
    console.log('\n--- Failures ---');
    console.log(JSON.stringify(failures, null, 2));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌', e.stack || e.message || e); process.exit(1); });
