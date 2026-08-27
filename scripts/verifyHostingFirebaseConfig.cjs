#!/usr/bin/env node
/**
 * Fail hosting builds that baked an empty Firebase web apiKey.
 * Local `npm run build` without VITE_FIREBASE_API_KEY previously shipped auth/invalid-api-key.
 */
const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '..', 'dist', 'assets'),
  path.join(__dirname, '..', 'dist', 'invoice', 'assets'),
];

function largeIndexBundles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^index-.*\.js$/.test(name))
    .map((name) => path.join(dir, name))
    .filter((file) => fs.statSync(file).size > 200_000);
}

const files = roots.flatMap(largeIndexBundles);
if (!files.length) {
  console.error('❌ No large index-*.js bundles found under dist/assets or dist/invoice/assets');
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const ok = /AIza[0-9A-Za-z_-]{20,}/.test(text);
  const rel = path.relative(path.join(__dirname, '..'), file);
  if (!ok) {
    console.error(`❌ ${rel} has no Firebase web apiKey (auth/invalid-api-key if deployed)`);
    failed = true;
  } else {
    console.log(`✅ ${rel} has Firebase web apiKey`);
  }
}

if (failed) {
  console.error('Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_APP_ID (see CI deploy-hosting.yml) and rebuild.');
  process.exit(1);
}
