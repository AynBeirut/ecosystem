#!/usr/bin/env node
/**
 * Phase 1 bank rec proof — E-Service (Av22LKyet8QmVcu9b8Njz1HVfoy1).
 *
 *   node scripts/verifyBankRecPhase1E2E.cjs
 *   node scripts/verifyBankRecPhase1E2E.cjs --cleanup
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE_ID = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const cleanup = process.argv.includes('--cleanup');
const START = '2026-07-01';
const END = '2026-07-31';

try {
  const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (error) {
  console.error('Failed to init Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function inDateRange(entryDate, start, end) {
  const d = entryDate.slice(0, 10);
  return d >= start && d <= end;
}

function buildBookLinesForAccount(accountId, accounts, entries, lines, { startDate, endDate }) {
  const postedById = new Map();
  for (const entry of entries) {
    if (entry.status !== 'posted') continue;
    if (!inDateRange(entry.date, startDate, endDate)) continue;
    postedById.set(entry.id, entry);
  }
  const rows = [];
  for (const line of lines) {
    if (line.accountId !== accountId) continue;
    const entry = postedById.get(line.entryId);
    if (!entry) continue;
    rows.push({
      lineId: line.id,
      entryId: entry.id,
      entryDate: entry.date.slice(0, 10),
      memo: entry.memo || '',
      debit: round2(line.debit || 0),
      credit: round2(line.credit || 0),
    });
  }
  return rows.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
}

async function main() {
  console.log('\nBank Rec Phase 1 E2E — E-Service\n');

  const acctsSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  const acct106 = acctsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).find((a) => a.code === '106');
  if (!acct106) {
    console.error('FAIL: GL account 106 not found');
    process.exit(1);
  }

  const [entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
  ]);
  const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = linesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const bookBefore = buildBookLinesForAccount(acct106.id, [acct106], entries, lines, {
    startDate: START,
    endDate: END,
  });
  console.log(`Book lines on 106 (${START} → ${END}): ${bookBefore.length}`);
  for (const row of bookBefore) {
    console.log(`  ${row.entryDate} Dr ${row.debit} Cr ${row.credit} — ${row.memo.slice(0, 60)}`);
  }

  const sessionId = `BR-106-${START}-${END}`;
  const sessionRef = db.collection('stores').doc(STORE_ID).collection('bankRecSessions').doc(sessionId);

  if (cleanup) {
    const linesCol = sessionRef.collection('statementLines');
    const existing = await linesCol.get();
    const batch = db.batch();
    existing.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(sessionRef);
    await batch.commit();
    console.log('\nCleanup: removed test session + statement lines.');
    return;
  }

  const now = new Date().toISOString();
  await sessionRef.set(
    {
      id: sessionId,
      storeId: STORE_ID,
      accountId: acct106.id,
      accountCode: '106',
      accountName: acct106.name || 'Bank Account - USD',
      startDate: START,
      endDate: END,
      status: 'draft',
      phase: 1,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  const stmtLines = [
    {
      id: `BSL-proof-${Date.now()}`,
      sessionId,
      storeId: STORE_ID,
      lineDate: '2026-07-25',
      debit: 100,
      credit: 0,
      description: 'E2E proof — statement deposit matches cash collection test',
      reference: 'verifyBankRecPhase1',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `BSL-proof-${Date.now()}-2`,
      sessionId,
      storeId: STORE_ID,
      lineDate: '2026-07-25',
      debit: 0,
      credit: 1,
      description: 'E2E proof — small fee line',
      reference: 'verifyBankRecPhase1',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const line of stmtLines) {
    await sessionRef.collection('statementLines').doc(line.id).set(line);
  }

  const stmSnap = await sessionRef.collection('statementLines').get();
  const bookNet = round2(bookBefore.reduce((s, r) => s + r.debit - r.credit, 0));
  const stmNet = round2(
    stmSnap.docs.reduce((s, d) => {
      const x = d.data();
      return s + (Number(x.debit) || 0) - (Number(x.credit) || 0);
    }, 0),
  );

  console.log('\n--- Proof summary ---');
  console.log(`Session: ${sessionId}`);
  console.log(`Statement lines written: ${stmSnap.size}`);
  console.log(`Book net (Dr−Cr): ${bookNet}`);
  console.log(`Statement net: ${stmNet}`);
  console.log(`Difference (informational): ${round2(stmNet - bookNet)}`);

  const hasCashCollection = bookBefore.some((r) => String(r.memo).toLowerCase().includes('cash collection'));
  if (bookBefore.length < 1) {
    console.error('\nFAIL: expected at least one book line on 106 in July 2026');
    process.exit(1);
  }
  if (stmSnap.size < 2) {
    console.error('\nFAIL: expected 2 statement lines');
    process.exit(1);
  }
  console.log('\nPASS: Phase 1 data model + book pull + statement persistence.');
  console.log('UI: Accounting → Bank Rec tab on staging after deploy.');
  console.log('Cleanup: node scripts/verifyBankRecPhase1E2E.cjs --cleanup');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
