#!/usr/bin/env node
/**
 * Nipco FG balance correction — reclass Dr 121 / Cr 120 (separate from COA migration).
 *
 * Usage:
 *   node scripts/nipcoFgCorrection.cjs --dry-run
 *   node scripts/nipcoFgCorrection.cjs --write
 */
const admin = require('firebase-admin');
const path = require('path');

const NIPCO_STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const FG_DOC_ID = 'acct-1201';
const RAW_DOC_ID = 'acct-1200';
const AMOUNT = 44504.36;
const MEMO =
  'ADJ — Nipco FG inventory true-up (pre-production COA); reclass erroneous FG credits to raw materials — audit ref COA-FG-2026-07';
const SOURCE_ID = 'nipco-fg-trueup-2026-07-25';
const EVENT = 'fg-inventory-trueup';
const DATE = '2026-07-25T12:00:00.000Z';

const dryRun = !process.argv.includes('--write');

const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}

const functionsAdmin = require('../functions/node_modules/firebase-admin');
if (!functionsAdmin.apps.length) {
  functionsAdmin.initializeApp({
    credential: functionsAdmin.credential.cert(sa),
    projectId: 'market-flow-7b074',
  });
}

const {
  ensureDefaultChartOfAccounts,
  postJournalEntry,
  accountsMap,
} = require('../functions/lib/lib/ledger/postingService');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function trialBalance(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  const sums = new Map();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const cur = sums.get(line.accountId) || { d: 0, c: 0 };
    cur.d += Number(line.debit) || 0;
    cur.c += Number(line.credit) || 0;
    sums.set(line.accountId, cur);
  }
  let totalD = 0;
  let totalC = 0;
  const row = (id) => {
    const acct = accounts.find((a) => a.id === id);
    if (!acct) return null;
    const s = sums.get(id) || { d: 0, c: 0 };
    let d = s.d;
    let c = s.c;
    const opening = round2(Number(acct.openingBalance) || 0);
    if (opening !== 0) {
      if (acct.normalBalance === 'debit') d += opening;
      else c += opening;
    }
    let tbD = 0;
    let tbC = 0;
    if (acct.normalBalance === 'debit') {
      const bal = round2(d - c);
      if (bal >= 0) tbD = bal;
      else tbC = -bal;
    } else {
      const bal = round2(c - d);
      if (bal >= 0) tbC = bal;
      else tbD = -bal;
    }
    return { code: acct.code, tbD, tbC, netDebit: round2(d - c) };
  };
  for (const acct of accounts) {
    const s = sums.get(acct.id) || { d: 0, c: 0 };
    let d = s.d;
    let c = s.c;
    const opening = round2(Number(acct.openingBalance) || 0);
    if (opening !== 0) {
      if (acct.normalBalance === 'debit') d += opening;
      else c += opening;
    }
    let tbD = 0;
    let tbC = 0;
    if (acct.normalBalance === 'debit') {
      const bal = round2(d - c);
      if (bal >= 0) tbD = bal;
      else tbC = -bal;
    } else {
      const bal = round2(c - d);
      if (bal >= 0) tbC = bal;
      else tbD = -bal;
    }
    if (tbD === 0 && tbC === 0) continue;
    totalD += tbD;
    totalC += tbC;
  }
  return {
    totalD: round2(totalD),
    totalC: round2(totalC),
    fg: row(FG_DOC_ID),
    raw: row(RAW_DOC_ID),
  };
}

async function loadGl(storeId) {
  const db = admin.firestore();
  const [acctsSnap, entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
    db.collection('stores').doc(storeId).collection('journalEntries').get(),
    db.collection('stores').doc(storeId).collection('journalLines').get(),
  ]);
  return {
    accounts: acctsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function main() {
  const before = await loadGl(NIPCO_STORE);
  const tbBefore = trialBalance(before.accounts, before.entries, before.lines);
  console.log('TB before correction:', tbBefore.totalD, tbBefore.totalC);
  console.log('121 before:', tbBefore.fg);
  console.log('120 before:', tbBefore.raw);

  const proposal = {
    storeId: NIPCO_STORE,
    date: DATE,
    memo: MEMO,
    sourceType: 'adjustment',
    sourceId: SOURCE_ID,
    event: EVENT,
    createdBy: 'system:nipcoFgCorrection.cjs',
    lines: [
      { accountId: FG_DOC_ID, debit: AMOUNT, credit: 0, description: 'FG true-up — reclass from historical COGS relief' },
      { accountId: RAW_DOC_ID, debit: 0, credit: AMOUNT, description: 'Raw materials offset — FG true-up COA-FG-2026-07' },
    ],
  };
  console.log('\nProposed entry:', JSON.stringify(proposal, null, 2));

  if (dryRun) {
    console.log('\nDry run — no post.');
    return;
  }

  const accounts = await ensureDefaultChartOfAccounts(NIPCO_STORE);
  const result = await postJournalEntry(proposal, accountsMap(accounts));
  console.log('\nPosted:', result);

  const after = await loadGl(NIPCO_STORE);
  const tbAfter = trialBalance(after.accounts, after.entries, after.lines);
  console.log('\nTB after correction:', tbAfter.totalD, tbAfter.totalC, 'balanced:', tbAfter.totalD === tbAfter.totalC);
  console.log('121 after:', tbAfter.fg);
  console.log('120 after:', tbAfter.raw);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
