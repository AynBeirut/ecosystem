#!/usr/bin/env node
/**
 * Phase 2 bank rec — auto-match $100 statement to cash collection book line (E-Service).
 *
 *   node scripts/verifyBankRecPhase2E2E.cjs
 *   node scripts/verifyBankRecPhase2E2E.cjs --cleanup
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const STORE_ID = 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const cleanup = process.argv.includes('--cleanup');
const START = '2026-07-01';
const END = '2026-07-31';
const SESSION_ID = `BR-106-${START}-${END}`;

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

function lineNet(line) {
  return round2((Number(line.debit) || 0) - (Number(line.credit) || 0));
}

function suggestAutoMatches(statementLines, bookLines, existingMatches, dateWindowDays = 3) {
  const matchedStmt = new Set(existingMatches.map((m) => m.statementLineId));
  const matchedBook = new Set(existingMatches.map((m) => m.bookLineId));
  const out = [];
  for (const stmt of statementLines) {
    if (matchedStmt.has(stmt.id)) continue;
    const stmtNet = lineNet(stmt);
    const candidate = bookLines.find((book) => {
      if (matchedBook.has(book.lineId)) return false;
      if (lineNet(book) !== stmtNet) return false;
      const days = Math.abs(
        (new Date(stmt.lineDate).getTime() - new Date(book.entryDate).getTime()) / (86400000),
      );
      return days <= dateWindowDays;
    });
    if (candidate) {
      out.push({ statementLineId: stmt.id, bookLineId: candidate.lineId });
      matchedStmt.add(stmt.id);
      matchedBook.add(candidate.lineId);
    }
  }
  return out;
}

async function main() {
  console.log('\nBank Rec Phase 2 E2E — E-Service\n');

  const sessionRef = db.collection('stores').doc(STORE_ID).collection('bankRecSessions').doc(SESSION_ID);

  if (cleanup) {
    const [linesSnap, matchSnap] = await Promise.all([
      sessionRef.collection('statementLines').get(),
      sessionRef.collection('bankRecMatches').get(),
    ]);
    const batch = db.batch();
    linesSnap.docs.forEach((d) => batch.delete(d.ref));
    matchSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(sessionRef);
    await batch.commit();
    console.log('Cleanup: removed Phase 2 test session.');
    return;
  }

  const acctsSnap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  const acct106 = acctsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).find((a) => a.code === '106');
  if (!acct106) {
    console.error('FAIL: account 106 missing');
    process.exit(1);
  }

  const [entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
  ]);

  const cashEntry = entriesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((e) => String(e.memo || '').toLowerCase().includes('cash collection') && e.status === 'posted');
  if (!cashEntry) {
    console.error('FAIL: no cash collection JE');
    process.exit(1);
  }

  const bookLineDoc = linesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((l) => l.entryId === cashEntry.id && l.accountId === acct106.id && round2(l.debit) === 100);
  if (!bookLineDoc) {
    console.error('FAIL: no Dr 100 book line on 106 for cash collection');
    process.exit(1);
  }

  const now = new Date().toISOString();
  await sessionRef.set(
    {
      id: SESSION_ID,
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

  const stmtId = `BSL-p2-${Date.now()}`;
  const stmtLine = {
    id: stmtId,
    sessionId: SESSION_ID,
    storeId: STORE_ID,
    lineDate: '2026-07-25',
    debit: 100,
    credit: 0,
    description: 'Phase 2 proof — bank deposit matches GL cash collection',
    reference: 'verifyBankRecPhase2',
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  };
  await sessionRef.collection('statementLines').doc(stmtId).set(stmtLine);

  const bookLines = [
    {
      lineId: bookLineDoc.id,
      entryDate: String(cashEntry.date).slice(0, 10),
      debit: round2(bookLineDoc.debit),
      credit: round2(bookLineDoc.credit),
    },
  ];

  const pairs = suggestAutoMatches([stmtLine], bookLines, [], 3);
  if (pairs.length !== 1) {
    console.error('FAIL: auto-match suggestion count', pairs.length);
    process.exit(1);
  }

  const matchId = `BRM-p2-${Date.now()}`;
  await sessionRef.collection('bankRecMatches').doc(matchId).set({
    id: matchId,
    sessionId: SESSION_ID,
    storeId: STORE_ID,
    statementLineId: stmtId,
    bookLineId: bookLineDoc.id,
    matchType: 'auto',
    matchedAt: now,
  });

  const matchSnap = await sessionRef.collection('bankRecMatches').get();
  console.log('Book line:', bookLineDoc.id, 'Dr', bookLineDoc.debit, cashEntry.memo.slice(0, 50));
  console.log('Statement line:', stmtId, 'Dr 100');
  console.log('Matches persisted:', matchSnap.size);
  if (matchSnap.size < 1) {
    console.error('FAIL');
    process.exit(1);
  }
  console.log('\nPASS: Phase 2 matching engine (1:1 amount + date window).');
  console.log('Cleanup: node scripts/verifyBankRecPhase2E2E.cjs --cleanup');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
