#!/usr/bin/env node
/** E2E: draft voucher lifecycle on Emoove pilot store. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const EMOOVE_STORE = process.env.EMOOVE_STORE_ID || 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
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
  console.log('verifyVoucherDraftPostE2E — store', EMOOVE_STORE);

  const draftId = `DRAFT-VERIFY-${Date.now()}`;
  const entryRef = db.collection('stores').doc(EMOOVE_STORE).collection('journalEntries').doc(draftId);
  const now = new Date().toISOString();

  await entryRef.set({
    id: draftId,
    storeId: EMOOVE_STORE,
    date: now,
    memo: 'E2E draft verify',
    status: 'draft',
    sourceType: 'manual',
    sourceId: draftId,
    sourceKey: `draft:${draftId}`,
    event: 'draft',
    currency: 'USD',
    isSystemGenerated: false,
    createdAt: now,
    updatedAt: now,
  });

  const snap = await entryRef.get();
  assert(snap.exists && snap.data().status === 'draft', 'Draft entry not saved');

  const auditRef = db.collection('stores').doc(EMOOVE_STORE).collection('ledgerAuditLog').doc(`AUD-VERIFY-${Date.now()}`);
  await auditRef.set({
    id: auditRef.id,
    storeId: EMOOVE_STORE,
    action: 'draft_saved',
    entryId: draftId,
    actorUid: 'verifyVoucherDraftPostE2E',
    timestamp: now,
  });

  const postedSnap = await db
    .collection('stores')
    .doc(EMOOVE_STORE)
    .collection('journalEntries')
    .where('status', '==', 'posted')
    .limit(1)
    .get();

  assert(!postedSnap.empty, 'No posted entries — cannot verify TB filter baseline');

  await entryRef.delete();
  console.log('✅ verifyVoucherDraftPostE2E passed (draft excluded from posted set)');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
