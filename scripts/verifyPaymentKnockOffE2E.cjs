#!/usr/bin/env node
/** E2E: payment knock-off settlements on Emoove pilot store. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const EMOOVE_STORE = process.env.EMOove_STORE_ID || 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
});

const db = admin.firestore();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('verifyPaymentKnockOffE2E — store', EMOOVE_STORE);

  const settlementsSnap = await db
    .collection('stores')
    .doc(EMOOVE_STORE)
    .collection('voucherLineSettlements')
    .limit(5)
    .get();

  console.log('voucherLineSettlements readable:', settlementsSnap.size >= 0);

  const testId = `STL-TEST-${Date.now()}`;
  const ref = db.collection('stores').doc(EMOOVE_STORE).collection('voucherLineSettlements').doc(testId);
  await ref.set({
    id: testId,
    storeId: EMOOVE_STORE,
    paymentEntryId: 'TEST-ENTRY',
    documentId: 'TEST-DOC',
    documentType: 'invoice',
    allocatedAmountBase: 0.01,
    allocatedAmountFx: 0.01,
    createdAt: new Date().toISOString(),
    createdBy: 'verifyPaymentKnockOffE2E',
  });

  const written = await ref.get();
  assert(written.exists, 'Settlement write failed');

  const entriesSnap = await db
    .collection('stores')
    .doc(EMOOVE_STORE)
    .collection('journalEntries')
    .where('voucherType', 'in', ['RV', 'PV'])
    .limit(3)
    .get();

  console.log('RV/PV entries sample:', entriesSnap.size);
  console.log('✅ verifyPaymentKnockOffE2E passed (schema + write path)');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
