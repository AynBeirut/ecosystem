#!/usr/bin/env node
/**
 * R2 upload E2E proof — validates presign signer + credentials + bucket + public serving.
 *
 * Reads credentials from env (never hardcode/commit):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 *
 * Flow: presign PUT -> upload test PNG -> GET public URL -> assert served + is R2 domain.
 *
 * Usage:
 *   R2_ACCOUNT_ID=.. R2_ACCESS_KEY_ID=.. R2_SECRET_ACCESS_KEY=.. \
 *   R2_BUCKET=grabio-media R2_PUBLIC_URL=https://pub-...r2.dev \
 *   node scripts/verifyR2UploadE2E.cjs
 */
const path = require('path');
const { presignPutUrl, sanitizeFileName } = require('../functions/lib/lib/r2Presign');

function assert(c, m) { if (!c) throw new Error(m); }

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
};
const publicBase = String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

for (const [k, v] of Object.entries({ ...config, publicBase })) {
  assert(v, `Missing env: ${k}`);
}

// 1x1 transparent PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const body = Buffer.from(PNG_BASE64, 'base64');

async function main() {
  const storeId = 'e2e-test-store';
  const fileName = sanitizeFileName(`r2-e2e-${Date.now()}.png`);
  const key = `products/${storeId}/${Date.now()}_${fileName}`;

  console.log('=== R2 Upload E2E ===');
  console.log('bucket:', config.bucket, '| key:', key);

  const uploadUrl = presignPutUrl(config, { key, expiresSeconds: 300 });
  assert(uploadUrl.includes(`${config.accountId}.r2.cloudflarestorage.com`), 'Upload URL not R2 endpoint');
  assert(uploadUrl.includes('X-Amz-Signature='), 'Missing signature');
  console.log('✓ Presigned PUT URL generated');

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body,
  });
  assert(putRes.ok, `PUT failed: ${putRes.status} ${await putRes.text()}`);
  console.log(`✓ Uploaded to R2 (HTTP ${putRes.status})`);

  const publicUrl = `${publicBase}/${key}`;
  assert(!publicUrl.includes('firebasestorage.googleapis.com'), 'Public URL must NOT be Firebase Storage');
  assert(/r2\.dev|r2\.cloudflarestorage\.com|media\./.test(publicUrl), 'Public URL not an R2 domain');

  // R2 public propagation can lag a moment; retry a few times.
  let getRes;
  for (let attempt = 1; attempt <= 5; attempt++) {
    getRes = await fetch(publicUrl);
    if (getRes.ok) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(getRes.ok, `Public GET failed: ${getRes.status} for ${publicUrl}`);
  const contentType = getRes.headers.get('content-type') || '';
  const bytes = Buffer.from(await getRes.arrayBuffer());
  assert(bytes.length === body.length, `Served size ${bytes.length} != uploaded ${body.length}`);
  console.log(`✓ Public GET OK (HTTP ${getRes.status}, content-type: ${contentType}, ${bytes.length} bytes)`);

  console.log('\nPublic URL:', publicUrl);
  console.log('Domain check: R2 (not firebasestorage.googleapis.com) ✓');
  console.log('\n✅ R2 upload E2E passed');
}

main().catch((e) => { console.error('\n❌', e.message || e); process.exit(1); });
