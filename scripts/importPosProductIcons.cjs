#!/usr/bin/env node
/**
 * Import exact product icons from POS export (Admin → Export products CSV/JSON).
 *
 * JSON formats supported:
 *   { "products": [ { "id": 1, "name": "...", "icon": "☕" }, ... ] }
 *   [ { "id": 1, "name": "...", "icon": "☕" }, ... ]
 *
 * Usage:
 *   node scripts/importPosProductIcons.cjs --store-id=8WgfKtga... --file=products.json --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const storeArg = argv.find((a) => a.startsWith('--store-id='));
const fileArg = argv.find((a) => a.startsWith('--file='));
const storeId = storeArg ? storeArg.split('=')[1] : '';
const filePath = fileArg ? fileArg.split('=')[1] : '';
const WRITE = argv.includes('--write');

if (!storeId || !filePath) {
  console.error('Usage: node scripts/importPosProductIcons.cjs --store-id=STORE_ID --file=export.json [--write]');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const rows = Array.isArray(raw) ? raw : Array.isArray(raw.products) ? raw.products : [];
if (rows.length === 0) {
  console.error('No products found in export file');
  process.exit(1);
}

const byLocalId = new Map();
const byName = new Map();
for (const row of rows) {
  const icon = String(row.icon || '').trim();
  if (!icon) continue;
  const localId = String(row.id ?? row.productId ?? '').trim();
  const name = String(row.name || '').trim().toLowerCase();
  if (localId) byLocalId.set(localId, icon);
  if (name) byName.set(name, icon);
}

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

(async () => {
  const snap = await db.collection('products').where('storeId', '==', storeId).get();
  let matched = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const localId = String(data.localId || doc.id.replace(`pos-${storeId}-`, '')).trim();
    const nameKey = String(data.name || '').trim().toLowerCase();
    const icon = byLocalId.get(localId) || byLocalId.get(String(localId)) || byName.get(nameKey);
    if (!icon) continue;
    matched += 1;
    if (WRITE) {
      batch.update(doc.ref, {
        icon,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (WRITE && batchCount > 0) await batch.commit();

  console.log(`Export rows with icon: ${byLocalId.size + byName.size}`);
  console.log(`Firestore products matched: ${matched} / ${snap.size}`);
  if (!WRITE) console.log('Dry run — add --write to apply.');
  else console.log('✅ POS icons imported.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
