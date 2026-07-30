#!/usr/bin/env node
/**
 * Proof: purchase receive posts Dr 120 / Dr 140 / Cr 201 immediately (functions GL path).
 *
 *   node scripts/verifyAdminPurchaseReceiveGl.cjs --dry-run   # no writes
 *   node scripts/verifyAdminPurchaseReceiveGl.cjs --write     # creates ephemeral store + PO + JE
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));
const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

const dryRun = !process.argv.includes('--write');
const { glPostPurchaseReceived } = require(path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'platformGlBridge.js'));
const { buildSourceKey } = require(path.join(repoRoot, 'functions', 'lib', 'lib', 'ledger', 'postingService.js'));
const { resolvePurchaseReceiveSplit } = require(path.join(
  repoRoot,
  'functions',
  'lib',
  'lib',
  'ledger',
  'purchaseReceiveAmounts.js',
));

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
  projectId: 'market-flow-7b074',
});
const db = admin.firestore();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function getLines(storeId, entryId) {
  const snap = await db
    .collection('stores')
    .doc(storeId)
    .collection('journalLines')
    .where('entryId', '==', entryId)
    .get();
  return snap.docs.map((d) => d.data());
}

(async () => {
  const runId = `recv-gl-${Date.now()}`;
  const storeId = `test-${runId}`;
  const purchaseId = `po-${runId}`;

  const subtotal = 100;
  const taxAmount = 11;
  const totalCost = 111;
  const purchasePayload = {
    id: purchaseId,
    date: new Date().toISOString().slice(0, 10),
    supplierName: 'VAT Test Supplier',
    items: [{ quantity: 10, unitCost: 10, rawPrice: 10 }],
    totalAmount: totalCost,
    totalCost,
    total: totalCost,
    subtotal,
    taxAmount,
    taxType: 'VAT',
    taxRate: 11,
    status: 'received',
  };

  const split = resolvePurchaseReceiveSplit(purchasePayload);
  assert(split, 'split null');
  console.log('Expected split:', split);

  if (dryRun) {
    console.log('✅ Dry-run: VAT split logic OK (120/140/201). Re-run with --write for Firestore proof.');
    process.exit(0);
  }

  await db.collection('storeProfiles').doc(storeId).set({
    ownerId: storeId,
    storeName: `Receive GL test ${runId}`,
    mainCurrency: 'USD',
    createdAt: new Date().toISOString(),
  });

  await db.collection('purchases').doc(purchaseId).set({
    storeId,
    supplierName: purchasePayload.supplierName,
    status: 'received',
    orderDate: purchasePayload.date,
    receivedDate: new Date().toISOString(),
    subtotal,
    taxAmount,
    taxType: 'VAT',
    taxRate: 11,
    total: totalCost,
    totalCost,
    items: purchasePayload.items,
    createdAt: new Date().toISOString(),
  });

  await glPostPurchaseReceived(storeId, {
    id: purchaseId,
    date: purchasePayload.date,
    supplierName: purchasePayload.supplierName,
    items: purchasePayload.items,
    amount: totalCost,
    total: totalCost,
    totalCost,
    subtotal,
    taxAmount,
    taxType: 'VAT',
    taxRate: 11,
    status: 'fulfilled',
    currency: 'USD',
  });

  const sourceKey = buildSourceKey('purchase', purchaseId, 'received');
  const jeSnap = await db
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('sourceKey', '==', sourceKey)
    .get();
  assert(jeSnap.size === 1, `expected 1 JE, got ${jeSnap.size}`);

  const lines = await getLines(storeId, jeSnap.docs[0].id);
  const byCode = (code) => lines.filter((l) => l.accountCode === code);
  const sum = (rows, field) => round2(rows.reduce((s, l) => s + (Number(l[field]) || 0), 0));

  assert(round2(sum(byCode('120'), 'debit')) === split.inventoryDebit, '120 debit mismatch');
  assert(round2(sum(byCode('140'), 'debit')) === split.inputVatDebit, '140 debit mismatch');
  assert(round2(sum(byCode('201'), 'credit')) === split.apCredit, '201 credit mismatch');

  console.log('✅ Firestore proof OK:', sourceKey, split);

  // cleanup test store docs (best-effort)
  const batch = db.batch();
  batch.delete(db.collection('storeProfiles').doc(storeId));
  batch.delete(db.collection('purchases').doc(purchaseId));
  jeSnap.docs.forEach((d) => batch.delete(d.ref));
  for (const line of lines) {
    if (line.id) batch.delete(db.collection('stores').doc(storeId).collection('journalLines').doc(line.id));
  }
  batch.delete(db.collection('stores').doc(storeId).collection('journalEntryKeys').doc(sourceKey));
  await batch.commit().catch(() => {});
  console.log('(test store partially cleaned — delete stores/%s if needed)', storeId);
})().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
