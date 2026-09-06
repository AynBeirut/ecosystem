#!/usr/bin/env node
/**
 * Reverse posted manual test vouchers (memo "Test") for Little Hands.
 *
 *   node scripts/reverseTestVouchersLittleHands.cjs --dry-run
 *   node scripts/reverseTestVouchersLittleHands.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const CREATED_BY = 'cursor-test-voucher-cleanup-2026-08-31';

const { postJournalEntry, accountsMap } = require('../functions/lib/lib/ledger/postingService');

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) {
    console.error('Missing serviceAccountKey.json');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
      projectId: 'market-flow-7b074',
    });
  }
  return admin.firestore();
}

function isTestEntry(entry) {
  const hay = [entry.memo, entry.voucherNumber, JSON.stringify(entry.voucherMeta || {})]
    .join(' ')
    .toLowerCase();
  return /\btest\b/.test(hay);
}

async function reversePostedEntry(db, storeId, originalEntryId, accounts) {
  const map = accountsMap(accounts);
  const entryRef = db.collection('stores').doc(storeId).collection('journalEntries').doc(originalEntryId);
  const snap = await entryRef.get();
  if (!snap.exists) throw new Error(`Entry not found: ${originalEntryId}`);
  const original = { id: snap.id, ...snap.data() };
  if (original.status !== 'posted') {
    return { skipped: true, reason: original.status, originalEntryId };
  }
  if (original.reversalOfEntryId) {
    return { skipped: true, reason: 'is_reversal', originalEntryId };
  }

  const linesSnap = await db
    .collection('stores')
    .doc(storeId)
    .collection('journalLines')
    .where('entryId', '==', originalEntryId)
    .get();

  const reversedLines = linesSnap.docs.map((doc) => {
    const line = doc.data();
    return {
      accountId: line.accountId,
      debit: Number(line.credit) || 0,
      credit: Number(line.debit) || 0,
      description: line.description ? `Reversal: ${line.description}` : 'Reversal',
    };
  });

  const result = await postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `Reversal of ${original.voucherNumber || originalEntryId} (test voucher cleanup)`,
      sourceType: 'reversal',
      sourceId: originalEntryId,
      event: 'storno-test-cleanup',
      createdBy: CREATED_BY,
      voucherType: original.voucherType,
      lines: reversedLines,
    },
    map,
  );

  if (!result.idempotentReplay) {
    const now = new Date().toISOString();
    await entryRef.set({ status: 'reversed', updatedAt: now }, { merge: true });
    await db
      .collection('stores')
      .doc(storeId)
      .collection('journalEntries')
      .doc(result.entryId)
      .set({ reversalOfEntryId: originalEntryId, updatedAt: now }, { merge: true });
  }

  return { originalEntryId, reversalEntryId: result.entryId, idempotentReplay: result.idempotentReplay };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = initDb();

  const [entriesSnap, accountsSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('journalEntries').where('status', '==', 'posted').get(),
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const targets = entriesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isTestEntry)
    .map((e) => ({
      id: e.id,
      date: String(e.date || '').slice(0, 10),
      memo: e.memo,
      voucher: e.voucherNumber,
    }));

  console.log(`Store ${STORE_ID}: ${targets.length} posted test voucher(s)`);
  console.log(JSON.stringify(targets, null, 2));

  if (!targets.length) return;
  if (!apply) {
    console.log('Dry run — pass --apply to reverse.');
    return;
  }

  const results = [];
  for (const target of targets) {
    const result = await reversePostedEntry(db, STORE_ID, target.id, accounts);
    results.push(result);
    console.log('Reversed', target.voucher || target.id, '→', result.reversalEntryId || result.reason);
  }

  const reportPath = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-test-voucher-cleanup-${new Date().toISOString().slice(0, 10)}.json`,
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ storeId: STORE_ID, cleanedAt: new Date().toISOString(), targets, results }, null, 2),
  );
  console.log('Report:', reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
