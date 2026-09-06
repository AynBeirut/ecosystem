#!/usr/bin/env node
/**
 * Live JV post on Little Hands — map + balance + postJournalEntry + verify + reverse.
 *   node scripts/verifyLittleHandsJvLivePost.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const RATE = Number(process.env.LH_FX_RATE) || 89_500;
const AMOUNT_USD = 1;
const CREATED_BY = 'verifyLittleHandsJvLivePost-2026-09-04';

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('❌ serviceAccountKey.json missing');
  process.exit(1);
}
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
    projectId: 'market-flow-7b074',
  });
}

const db = admin.firestore();
const { postJournalEntry, accountsMap } = require('../functions/lib/lib/ledger/postingService');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pickAccounts(accounts) {
  const cash =
    accounts.find((a) => a.code === '102' && a.isActive) ||
    accounts.find((a) => String(a.code).startsWith('53') && a.isActive) ||
    accounts.find((a) => /cash|bank/i.test(a.name) && a.isActive);
  const expense =
    accounts.find((a) => String(a.code).startsWith('6') && a.isActive && a.id !== cash?.id) ||
    accounts.find((a) => a.type === 'expense' && a.isActive);
  assert(cash, 'No cash/bank account found');
  assert(expense, 'No expense account found');
  return { cash, expense };
}

async function loadAccounts() {
  const snap = await db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function reverseEntry(entryId, accounts) {
  const map = accountsMap(accounts);
  const linesSnap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalLines')
    .where('entryId', '==', entryId)
    .get();
  const reversedLines = linesSnap.docs.map((doc) => {
    const line = doc.data();
    return {
      accountId: line.accountId,
      debit: Number(line.credit) || 0,
      credit: Number(line.debit) || 0,
      description: 'Live JV verify reversal',
    };
  });
  const result = await postJournalEntry(
    {
      storeId: STORE_ID,
      date: new Date().toISOString(),
      memo: `Reversal live JV verify ${entryId}`,
      sourceType: 'reversal',
      sourceId: entryId,
      event: `storno-jv-live-${entryId}`,
      createdBy: CREATED_BY,
      voucherType: 'JV',
      lines: reversedLines,
    },
    map,
  );
  await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalEntries')
    .doc(entryId)
    .set({ status: 'reversed', updatedAt: new Date().toISOString() }, { merge: true });
  return result;
}

async function main() {
  console.log('=== Little Hands live JV verify ===');
  console.log('Store:', STORE_ID);

  const vendor = path.join(__dirname, '..', 'vendor/beirut-finance-flow-main');
  const vitestOut = execSync('npm test -- voucherPreviewFix.test.ts voucherJdEdwardsAllTypes.test.ts 2>&1', {
    cwd: vendor,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  assert(/Tests\s+\d+\s+passed/.test(vitestOut), 'Unit tests failed');
  console.log('✅ Unit tests (map + matrix balance) passed');

  const accounts = await loadAccounts();
  assert(accounts.length > 0, 'No ledger accounts');
  const { cash, expense } = pickAccounts(accounts);
  console.log(`Accounts: Dr ${expense.code} · Cr ${cash.code}`);

  const lbpForeign = Math.round(AMOUNT_USD * RATE);
  const sourceId = `jv-live-verify-${Date.now()}`;
  const lines = [
    {
      accountId: expense.id,
      debit: AMOUNT_USD,
      credit: 0,
      description: 'Live JV verify Dr',
      transactionCurrency: 'USD',
      fxRate: RATE,
      amountFx: lbpForeign,
    },
    {
      accountId: cash.id,
      debit: 0,
      credit: AMOUNT_USD,
      description: 'Live JV verify Cr',
      transactionCurrency: 'USD',
      fxRate: RATE,
      amountFx: lbpForeign,
    },
  ];

  const map = accountsMap(accounts);
  const posted = await postJournalEntry(
    {
      storeId: STORE_ID,
      date: new Date().toISOString().slice(0, 10),
      memo: 'Test — live JV verify (cursor 2026-09-04)',
      sourceType: 'manual',
      sourceId,
      event: 'jv-live-verify',
      createdBy: CREATED_BY,
      voucherType: 'JV',
      voucherMeta: { externalReference: sourceId },
      lines,
    },
    map,
  );

  assert(posted.entryId, 'No entryId returned');
  const entrySnap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalEntries')
    .doc(posted.entryId)
    .get();
  assert(entrySnap.exists && entrySnap.data().status === 'posted', 'Entry not posted');
  console.log('✅ Posted JV', posted.voucherNumber || posted.entryId, '→', posted.entryId);

  const rev = await reverseEntry(posted.entryId, accounts);
  console.log('✅ Reversed →', rev.entryId);

  const reportDir = path.join(__dirname, '..', 'reporting/data');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'littlehands-jv-live-verify-2026-09-04.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        storeId: STORE_ID,
        status: 'passed',
        postedEntryId: posted.entryId,
        voucherNumber: posted.voucherNumber,
        reversalEntryId: rev.entryId,
        amountUsd: AMOUNT_USD,
        fxRate: RATE,
        accounts: { debit: expense.code, credit: cash.code },
      },
      null,
      2,
    ),
  );
  console.log('Report:', reportPath);
  console.log('\n✅ Little Hands live JV verify PASSED');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
