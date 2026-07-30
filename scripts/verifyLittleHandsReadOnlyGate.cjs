#!/usr/bin/env node
/** Read-only gate: Little Hands TB snapshot — no writes. */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const admin = require(path.join(repoRoot, 'functions', 'node_modules', 'firebase-admin'));

const LITTLE_HANDS_STORE = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const serviceAccountPath = path.join(repoRoot, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))),
});

const db = admin.firestore();

async function main() {
  console.log('Little Hands read-only gate — store', LITTLE_HANDS_STORE);

  const entriesSnap = await db
    .collection('stores')
    .doc(LITTLE_HANDS_STORE)
    .collection('journalEntries')
    .where('status', '==', 'posted')
    .limit(500)
    .get();

  const linesSnap = await db.collection('stores').doc(LITTLE_HANDS_STORE).collection('journalLines').limit(2000).get();

  let debits = 0;
  let credits = 0;
  const postedIds = new Set(entriesSnap.docs.map((d) => d.id));
  linesSnap.docs.forEach((d) => {
    const l = d.data();
    if (!postedIds.has(l.entryId)) return;
    debits += Number(l.debit) || 0;
    credits += Number(l.credit) || 0;
  });

  debits = Math.round(debits * 100) / 100;
  credits = Math.round(credits * 100) / 100;

  console.log('Posted entries (sample cap 500):', entriesSnap.size);
  console.log('TB debits:', debits, 'credits:', credits, 'balanced:', debits === credits);
  console.log('✅ Read-only validation complete — no writes performed');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
