#!/usr/bin/env node
/**
 * Rebuild PREFIX-000001 numbers (global per type, ordered by document date) per store.
 *
 *   node scripts/migrateChronologicalDocumentNumbers.cjs --all-stores
 *   node scripts/migrateChronologicalDocumentNumbers.cjs --store=STORE_ID [--write]
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const {
  rebuildChronologicalNumbers,
  documentDateKeyFromFields,
  parseCreatedAtMs,
} = require('./lib/chronologicalDocumentNumbers.cjs');

const write = process.argv.includes('--write');
const allStores = process.argv.includes('--all-stores');
const storeArg = process.argv.find((a) => a.startsWith('--store='));
const SINGLE_STORE_ID = storeArg?.slice('--store='.length) || process.env.GRABIO_STORE_ID || null;

if (!admin.apps.length) {
  const saPath = path.join(__dirname, '../serviceAccountKey.json');
  const sa = require(saPath);
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

async function applyNumberUpdates(updates, fieldName, extraFields) {
  let changed = 0;
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400);
    if (!write) continue;
    const batch = db.batch();
    for (const u of chunk) {
      const patch = {
        [fieldName]: u.next,
        updatedAt: new Date().toISOString(),
        ...(extraFields ? extraFields(u.next) : {}),
      };
      batch.update(u.ref, patch);
    }
    await batch.commit();
    changed += chunk.length;
  }
  return changed;
}

async function renumberCollection(label, kind, docs, fieldName, prefixOverride, extraFields) {
  const rows = docs.map((d) => {
    const data = d.data();
    const createdRaw = data.createdAt || data.updatedAt || data.date;
    const docDate =
      data.date ||
      data.orderDate ||
      data.expenseDate ||
      data.startDate ||
      data.invoiceDate ||
      data.posSaleTimestamp;
    return {
      id: d.id,
      documentDateKey: documentDateKeyFromFields(docDate, createdRaw),
      createdAtMs: parseCreatedAtMs(createdRaw),
      ref: d.ref,
      prev: String(data[fieldName] || ''),
    };
  });
  const map = rebuildChronologicalNumbers(rows, kind, prefixOverride);
  const updates = [];
  for (const row of rows) {
    const next = map.get(row.id);
    if (!next || next === row.prev) continue;
    updates.push({ ref: row.ref, id: row.id, prev: row.prev, next });
  }
  const changed = await applyNumberUpdates(updates, fieldName, extraFields);
  return { label, total: rows.length, updates: updates.length, changed: write ? changed : 0 };
}

async function renumberJournalVouchers(storeId, voucherType) {
  const snap = await db.collection('stores').doc(storeId).collection('journalEntries').get();
  const docs = snap.docs.filter((d) => {
    const vt = String(d.data().voucherType || '').toUpperCase();
    return vt === voucherType;
  });
  return renumberCollection(`journal:${voucherType}`, voucherType, docs, 'voucherNumber');
}

async function migrateStore(storeId) {
  const sections = [];

  const invSnap = await db.collection('stores').doc(storeId).collection('financeInvoices').get();
  sections.push(await renumberCollection('financeInvoices', 'INV', invSnap.docs, 'invoiceNumber'));

  const estSnap = await db.collection('stores').doc(storeId).collection('financeEstimates').get();
  sections.push(await renumberCollection('financeEstimates', 'EST', estSnap.docs, 'estimateNumber'));

  const expSnap = await db.collection('stores').doc(storeId).collection('financeExpenses').get();
  sections.push(await renumberCollection('financeExpenses', 'EXP', expSnap.docs, 'expenseNumber'));

  const poSnap = await db.collection('purchases').where('storeId', '==', storeId).get();
  sections.push(
    await renumberCollection('purchases', 'PO', poSnap.docs, 'poNumber', undefined, (n) => ({
      purchaseOrderNumber: n,
      invoiceNumber: n,
    })),
  );

  const ordSnap = await db.collection('orders').where('storeId', '==', storeId).get();
  sections.push(await renumberCollection('orders', 'ORD', ordSnap.docs, 'invoiceNumber'));

  for (const vt of ['RV', 'PV', 'JV', 'CV', 'CRN', 'DRN']) {
    sections.push(await renumberJournalVouchers(storeId, vt));
  }

  return { storeId, sections };
}

async function discoverStoreIds() {
  const ids = new Set();

  const profiles = await db.collection('storeProfiles').get();
  profiles.docs.forEach((d) => ids.add(d.id));

  const stores = await db.collection('stores').get();
  stores.docs.forEach((d) => ids.add(d.id));

  const orders = await db.collection('orders').select('storeId').get();
  orders.docs.forEach((d) => {
    const sid = String(d.data().storeId || '').trim();
    if (sid) ids.add(sid);
  });

  const purchases = await db.collection('purchases').select('storeId').get();
  purchases.docs.forEach((d) => {
    const sid = String(d.data().storeId || '').trim();
    if (sid) ids.add(sid);
  });

  return [...ids].sort();
}

async function main() {
  if (!allStores && !SINGLE_STORE_ID) {
    console.error('Pass --all-stores or --store=STORE_ID');
    process.exit(1);
  }

  const storeIds = allStores ? await discoverStoreIds() : [SINGLE_STORE_ID];
  const rollup = {
    write,
    at: new Date().toISOString(),
    storeCount: storeIds.length,
    stores: [],
  };

  for (const storeId of storeIds) {
    console.log(`\n--- ${storeId} ---`);
    const result = await migrateStore(storeId);
    rollup.stores.push(result);
    const changed = result.sections.reduce((s, x) => s + x.changed, 0);
    console.log(`changed: ${changed}`);
  }

  const outName = allStores
    ? 'chronological-document-numbers-all-stores-2026-09-19.json'
    : `chronological-document-numbers-${String(SINGLE_STORE_ID).slice(0, 8)}-2026-09-19.json`;
  const outPath = path.join(__dirname, '..', 'reporting', 'data', outName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rollup, null, 2));
  console.log(`\nGate: ${outPath}`);
  if (!write) console.log('\nDry run — pass --write to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
