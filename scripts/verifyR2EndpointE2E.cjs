#!/usr/bin/env node
/**
 * Deployed R2 endpoint E2E — exercises the exact path the Admin UI uses.
 *
 * 1. Create temp store owner + storeProfiles doc (Admin SDK)
 * 2. Mint custom token -> exchange for real ID token (Identity Toolkit REST)
 * 3. POST /api/r2/presign with Bearer ID token  (auth + ownership validated server-side)
 * 4. PUT the image to the presigned URL
 * 5. GET the public URL -> assert served, R2 domain, not Firebase Storage
 * 6. Negative: presign for a store the user does NOT own -> expect 403
 * 7. Write a product doc with the R2 image URL -> confirm storefront data path
 *
 * Usage: node scripts/verifyR2EndpointE2E.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

const API_BASE = 'https://us-central1-market-flow-7b074.cloudfunctions.net/api';
const WEB_API_KEY = 'AIzaSyA0jzU0136sQM4QpBz6J0TYEsPn2JDTn1U';

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

function assert(c, m) { if (!c) throw new Error(m); }

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const body = Buffer.from(PNG_BASE64, 'base64');

const runId = `r2-ep-e2e-${Date.now()}`;
const storeId = `teststore_${runId}`;
const otherStoreId = `otherstore_${runId}`;
const uid = `testuser_${runId}`;
let productId = null;

async function exchangeCustomToken(customToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  assert(res.ok && data.idToken, `Token exchange failed: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function presign(idToken, targetStoreId) {
  return fetch(`${API_BASE}/r2/presign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: targetStoreId,
      folder: 'products',
      fileName: `${runId}.png`,
      contentType: 'image/png',
      sizeBytes: body.length,
    }),
  });
}

async function cleanup() {
  try { if (productId) await db.collection('products').doc(productId).delete(); } catch {}
  try { await db.collection('storeProfiles').doc(storeId).delete(); } catch {}
  try { await db.collection('storeProfiles').doc(otherStoreId).delete(); } catch {}
  try { await admin.auth().deleteUser(uid); } catch {}
}

async function main() {
  console.log(`=== Deployed R2 endpoint E2E — ${runId} ===\n`);

  await admin.auth().createUser({ uid, email: `${uid}@example.com`, password: `Pw!${runId}` });
  await db.collection('storeProfiles').doc(storeId).set({
    ownerId: uid, storeName: 'R2 E2E Test Store', createdAt: new Date().toISOString(),
  });
  await db.collection('storeProfiles').doc(otherStoreId).set({
    ownerId: `someone_else_${runId}`, storeName: 'Not Mine', createdAt: new Date().toISOString(),
  });
  console.log('✓ Temp user + store profiles created');

  const customToken = await admin.auth().createCustomToken(uid);
  const idToken = await exchangeCustomToken(customToken);
  console.log('✓ Real ID token obtained');

  // Negative: not the owner -> 403
  const forbidden = await presign(idToken, otherStoreId);
  assert(forbidden.status === 403, `Ownership check failed: expected 403, got ${forbidden.status}`);
  console.log('✓ Ownership enforced (403 for non-owned store)');

  // Positive: owned store -> presigned URL
  const presignRes = await presign(idToken, storeId);
  const presignData = await presignRes.json();
  assert(presignRes.ok, `Presign failed: ${presignRes.status} ${JSON.stringify(presignData)}`);
  assert(presignData.uploadUrl && presignData.publicUrl && presignData.key, 'Presign missing fields');
  assert(
    presignData.uploadUrl.includes('r2.cloudflarestorage.com'),
    'uploadUrl not an R2 endpoint',
  );
  assert(presignData.key.startsWith(`products/${storeId}/`), `Unexpected key: ${presignData.key}`);
  console.log('✓ Presign OK (deployed endpoint, secrets bound)');
  console.log('  key:', presignData.key);

  // Upload
  const putRes = await fetch(presignData.uploadUrl, {
    method: 'PUT', headers: { 'Content-Type': 'image/png' }, body,
  });
  assert(putRes.ok, `PUT failed: ${putRes.status} ${await putRes.text()}`);
  console.log(`✓ Uploaded to R2 (HTTP ${putRes.status})`);

  // Public serve
  assert(
    !presignData.publicUrl.includes('firebasestorage.googleapis.com'),
    'Public URL must NOT be Firebase Storage',
  );
  assert(/r2\.dev|media\./.test(presignData.publicUrl), 'Public URL not R2 domain');

  let getRes;
  for (let i = 0; i < 6; i++) {
    getRes = await fetch(presignData.publicUrl);
    if (getRes.ok) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(getRes.ok, `Public GET failed: ${getRes.status}`);
  const bytes = Buffer.from(await getRes.arrayBuffer());
  assert(bytes.length === body.length, `Served ${bytes.length} != ${body.length}`);
  console.log(`✓ Public GET OK (HTTP ${getRes.status}, ${bytes.length} bytes, ${getRes.headers.get('content-type')})`);

  // Storefront data path: product carries the R2 URL
  const ref = await db.collection('products').add({
    storeId, name: `R2 E2E Product ${runId}`, price: 1, currency: 'USD',
    image: presignData.publicUrl, inStock: true, status: 'active', createdAt: new Date().toISOString(),
  });
  productId = ref.id;
  const readBack = (await ref.get()).data();
  assert(readBack.image === presignData.publicUrl, 'Product image URL mismatch');
  assert(readBack.image.includes('r2.dev'), 'Product image not R2');
  console.log('✓ Product doc stores R2 URL (storefront renders via <img src>)');

  console.log('\nPublic URL:', presignData.publicUrl);
  console.log('\n✅ Deployed R2 endpoint E2E passed');
}

main()
  .then(cleanup)
  .catch(async (e) => { console.error('\n❌', e.message || e); await cleanup(); process.exit(1); });
