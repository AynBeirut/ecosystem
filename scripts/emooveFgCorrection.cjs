#!/usr/bin/env node
/** E-Moove FG reclass — Dr 121 / Cr 120 $623.26 */
const admin = require('firebase-admin');
const path = require('path');

const STORE = 'EZfuoNQFTJVU4cubNuckpp4K7zw2';
const AMOUNT = 623.26;
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

function tbTotals(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  let totalD = 0;
  let totalC = 0;
  const rowFor = (accountId) => {
    const acct = accounts.find((a) => a.id === accountId);
    if (!acct) return null;
    let d = 0;
    let c = 0;
    for (const l of lines) {
      if (l.accountId !== accountId || !posted.has(l.entryId)) continue;
      d += l.debit || 0;
      c += l.credit || 0;
    }
    const opening = Number(acct.openingBalance) || 0;
    const net = round2(opening + d - c);
    let tbD = 0;
    let tbC = 0;
    if (acct.normalBalance === 'debit') {
      const bal = round2(opening + d - c);
      if (bal >= 0) tbD = bal;
      else tbC = -bal;
    } else {
      const bal = round2(c - d + opening);
      if (bal >= 0) tbC = bal;
      else tbD = -bal;
    }
    return { code: acct.code, tbD, tbC, netDebit: net };
  };
  for (const acct of accounts) {
    const r = rowFor(acct.id);
    if (!r || (r.tbD === 0 && r.tbC === 0)) continue;
    totalD += r.tbD;
    totalC += r.tbC;
  }
  return {
    totalD: round2(totalD),
    totalC: round2(totalC),
    fg: rowFor('acct-1201'),
    raw: rowFor('acct-1200'),
  };
}

async function loadGl() {
  const db = admin.firestore();
  const [acctsSnap, entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(STORE).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE).collection('journalEntries').get(),
    db.collection('stores').doc(STORE).collection('journalLines').get(),
  ]);
  return {
    accounts: acctsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function main() {
  const before = await loadGl();
  const tbBefore = tbTotals(before.accounts, before.entries, before.lines);
  console.log('BEFORE', tbBefore);

  const proposal = {
    storeId: STORE,
    date: '2026-07-25T12:00:00.000Z',
    memo: 'ADJ — E-Moove FG inventory true-up (pre-production COA); reclass erroneous FG credits to raw materials — audit ref COA-FG-2026-07',
    sourceType: 'adjustment',
    sourceId: 'emoove-fg-trueup-2026-07-25',
    event: 'fg-inventory-trueup',
    createdBy: 'system:emooveFgCorrection.cjs',
    lines: [
      { accountId: 'acct-1201', debit: AMOUNT, credit: 0, description: 'FG true-up — reclass from historical COGS relief' },
      { accountId: 'acct-1200', debit: 0, credit: AMOUNT, description: 'Raw materials offset — FG true-up COA-FG-2026-07' },
    ],
  };

  if (dryRun) {
    console.log('DRY RUN', proposal);
    return;
  }

  const accounts = await ensureDefaultChartOfAccounts(STORE);
  const posted = await postJournalEntry(proposal, accountsMap(accounts));
  console.log('POSTED', posted);

  const after = await loadGl();
  const tbAfter = tbTotals(after.accounts, after.entries, after.lines);
  console.log('AFTER', tbAfter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
