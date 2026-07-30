#!/usr/bin/env node
/** Little Hands accounting UI gate — read-only Firestore checks for all major reports. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const saPath = path.join(repoRoot, 'serviceAccountKey.json');

if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) });
}

const db = admin.firestore();

async function loadPostedTb() {
  const entriesSnap = await db.collection('stores').doc(STORE).collection('journalEntries').where('status', '==', 'posted').limit(2500).get();
  const linesSnap = await db.collection('stores').doc(STORE).collection('journalLines').limit(8000).get();
  const posted = new Set(entriesSnap.docs.map((d) => d.id));
  let debits = 0;
  let credits = 0;
  linesSnap.docs.forEach((d) => {
    const l = d.data();
    if (!posted.has(l.entryId)) return;
    debits += Number(l.debit) || 0;
    credits += Number(l.credit) || 0;
  });
  return { debits, credits, postedCount: entriesSnap.size };
}

async function main() {
  console.log('Little Hands accounting suite — store', STORE);

  const [profileSnap, coaMetaSnap] = await Promise.all([
    db.collection('storeProfiles').doc(STORE).get(),
    db.collection('stores').doc(STORE).collection('ledgerMeta').doc('coa').get(),
  ]);
  const mode = profileSnap.data()?.accountingMode || coaMetaSnap.data()?.coaMode;
  console.log('accountingMode:', mode);

  const pcgSnap = await db.collection('stores').doc(STORE).collection('pcgClientAccounts').get();
  console.log('pcgClientAccounts:', pcgSnap.size);

  const accountsSnap = await db.collection('stores').doc(STORE).collection('ledgerAccounts').limit(5).get();
  console.log('ledgerAccounts sample:', accountsSnap.size);

  const tb = await loadPostedTb();
  const balanced = Math.abs(tb.debits - tb.credits) < 0.02;
  console.log(`TB posted JEs: ${tb.postedCount} debits: ${tb.debits.toFixed(2)} credits: ${tb.credits.toFixed(2)} balanced: ${balanced}`);

  const draftsSnap = await db.collection('stores').doc(STORE).collection('journalEntries').where('status', 'in', ['draft', 'pending_approval']).limit(10).get();
  console.log('draft/pending entries (cap 10):', draftsSnap.size);

  if (mode !== 'lebanese') {
    console.error('❌ Expected accountingMode=lebanese');
    process.exit(1);
  }
  if (!balanced) {
    console.error('❌ Trial balance not balanced');
    process.exit(1);
  }
  if (pcgSnap.size < 1) {
    console.error('❌ No pcgClientAccounts — run seedLittleHandsPcgClientAccounts.cjs --apply');
    process.exit(1);
  }

  console.log('✅ Little Hands accounting suite PASS');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
