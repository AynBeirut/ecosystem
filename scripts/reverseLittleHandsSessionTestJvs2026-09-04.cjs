#!/usr/bin/env node
/**
 * Reverse Little Hands session test JVs (2026-09-04 UI + agent verify).
 *   node scripts/reverseLittleHandsSessionTestJvs2026-09-04.cjs --dry-run
 *   node scripts/reverseLittleHandsSessionTestJvs2026-09-04.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const CREATED_BY = 'session-test-jv-cleanup-2026-09-04';

/** Posted JVs to reverse — agent verify + UI tests (NOT client production data). */
const TARGET_VOUCHERS = ['JV-2026-00004', 'JV-2026-00005', 'JV-2026-00006'];

const { postJournalEntry, accountsMap } = require('../functions/lib/lib/ledger/postingService');

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
      projectId: 'market-flow-7b074',
    });
  }
  return admin.firestore();
}

async function reversePostedEntry(db, storeId, originalEntryId, accounts) {
  const map = accountsMap(accounts);
  const entryRef = db.collection('stores').doc(storeId).collection('journalEntries').doc(originalEntryId);
  const snap = await entryRef.get();
  if (!snap.exists) throw new Error(`Entry not found: ${originalEntryId}`);
  const original = { id: snap.id, ...snap.data() };
  if (original.status !== 'posted') {
    return { skipped: true, reason: original.status, voucherNumber: original.voucherNumber };
  }
  if (original.reversalOfEntryId) {
    return { skipped: true, reason: 'is_reversal', voucherNumber: original.voucherNumber };
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
      description: 'Session test cleanup reversal',
    };
  });

  const result = await postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `Reversal of ${original.voucherNumber} (session test — not client data)`,
      sourceType: 'reversal',
      sourceId: originalEntryId,
      event: `storno-session-test-${originalEntryId}`,
      createdBy: CREATED_BY,
      voucherType: original.voucherType || 'JV',
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

  return {
    voucherNumber: original.voucherNumber,
    originalEntryId,
    reversalEntryId: result.entryId,
    idempotentReplay: result.idempotentReplay,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = initDb();

  const [entriesSnap, accountsSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const all = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const documented = [
    {
      voucherNumber: 'JV-2026-00002',
      status: 'posted',
      note: 'Aug 31 test cleanup reversal of JV-00001 — historical test, already storno chain',
    },
    {
      voucherNumber: 'JV-2026-00003',
      status: 'reversed',
      note: 'Agent live JV verify ($1) — already reversed',
    },
    ...TARGET_VOUCHERS.map((v) => ({
      voucherNumber: v,
      status: 'posted',
      note: '2026-09-04 session test — to reverse on --apply',
    })),
  ];

  const targets = all.filter(
    (e) => TARGET_VOUCHERS.includes(String(e.voucherNumber)) && e.status === 'posted' && !e.reversalOfEntryId,
  );

  console.log('Documented session test JVs (NOT client production data):');
  console.log(JSON.stringify(documented, null, 2));
  console.log(`\nTo reverse now: ${targets.length} posted`);
  targets.forEach((t) => console.log(' -', t.voucherNumber, t.memo));

  const reportPath = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    'littlehands-session-test-jvs-2026-09-04.json',
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  if (!apply) {
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          storeId: STORE_ID,
          classification: 'TEST_NOT_CLIENT_DATA',
          documented,
          pendingReverse: targets.map((t) => t.voucherNumber),
        },
        null,
        2,
      ),
    );
    console.log('\nDry run — pass --apply to reverse.', reportPath);
    return;
  }

  const results = [];
  for (const target of targets) {
    const result = await reversePostedEntry(db, STORE_ID, target.id, accounts);
    results.push(result);
    console.log('Reversed', result.voucherNumber, '→', result.reversalEntryId || result.reason);
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        storeId: STORE_ID,
        classification: 'TEST_NOT_CLIENT_DATA',
        documented,
        reversed: results,
      },
      null,
      2,
    ),
  );
  console.log('Report:', reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
