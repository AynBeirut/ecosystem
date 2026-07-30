#!/usr/bin/env node
/**
 * Nipco AP VAT true-up — $462.72 net (per-PO pieces from audit 2026-07-25).
 *
 *   node scripts/nipcoApVatTrueup.cjs --dry-run
 *   node scripts/nipcoApVatTrueup.cjs --write
 */
const admin = require('firebase-admin');
const path = require('path');

const NIPCO_STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const SOURCE_ID = 'nipco-ap-vat-trueup-2026-07-25';
const EVENT = 'ap-vat-subledger-alignment';
const DATE = '2026-07-25T18:00:00.000Z';
const MEMO =
  'ADJ — Nipco AP/subledger VAT alignment; Dr 120/140 Cr 201 per PO audit COA-AP-VAT-2026-07 (net +462.72)';
const CREATED_BY = 'system:nipcoApVatTrueup.cjs';

/** Per-PO (subledgerOpen − glNetAp); inputVat portion = VAT-type PO deltas from receive audit */
const PO_PIECES = [
  { invoice: 'PO-050', apCredit: 185.76, inputVat: 185.76 },
  { invoice: 'PO-278', apCredit: 124.15, inputVat: 124.15 },
  { invoice: 'PO-176', apCredit: 96.66, inputVat: 96.66 },
  { invoice: 'PO-094', apCredit: 44.76, inputVat: 44.76 },
  { invoice: 'PO-103', apCredit: 31.35, inputVat: 31.35 },
  { invoice: 'PO-280', apCredit: 28.36, inputVat: 0 },
  { invoice: 'PO-249', apCredit: 15.36, inputVat: 0 },
  { invoice: 'PO-342', apCredit: 1.96, inputVat: 0 },
  { invoice: 'PO-012', apCredit: -26.71, inputVat: 0 },
  { invoice: 'PO-014', apCredit: -16.79, inputVat: 0 },
  { invoice: 'PO-095', apCredit: -15.36, inputVat: 0 },
  { invoice: 'PO-142', apCredit: -6.78, inputVat: 0 },
];

const dryRun = !process.argv.includes('--write');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

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

async function main() {
  let netAp = 0;
  let netInv = 0;
  let netVat = 0;
  for (const p of PO_PIECES) {
    netAp = round2(netAp + p.apCredit);
    const vatPart = round2(Number(p.inputVat) || 0);
    const invPart = round2(p.apCredit - vatPart);
    netVat = round2(netVat + vatPart);
    netInv = round2(netInv + invPart);
  }
  console.log('Net Cr 201 (AP increase):', netAp, 'Dr 120:', netInv, 'Dr 140:', netVat);
  assertBalanced(netInv, netVat, netAp);

  const accounts = await ensureDefaultChartOfAccounts(NIPCO_STORE);
  const vatAcct = accounts.find((a) => a.code === '140');
  if (vatAcct && vatAcct.isActive === false) {
    await admin
      .firestore()
      .collection('stores')
      .doc(NIPCO_STORE)
      .collection('ledgerAccounts')
      .doc(vatAcct.id)
      .update({ isActive: true, updatedAt: new Date().toISOString() });
    vatAcct.isActive = true;
  }
  const map = accountsMap(accounts);
  const ap = accounts.find((a) => a.code === '201');
  const inv = accounts.find((a) => a.code === '120');
  const vat = accounts.find((a) => a.code === '140');
  if (!ap || !inv) throw new Error('Missing 201/120');

  const lines = [];
  if (netInv !== 0) {
    lines.push({
      accountId: inv.id,
      debit: netInv > 0 ? netInv : 0,
      credit: netInv < 0 ? -netInv : 0,
      description: 'AP VAT true-up — inventory portion (by PO)',
    });
  }
  if (netVat !== 0 && vat) {
    if (vat.isActive === false) {
      map.set(vat.id, { ...vat, isActive: true });
    }
    lines.push({
      accountId: vat.id,
      debit: netVat > 0 ? netVat : 0,
      credit: netVat < 0 ? -netVat : 0,
      description: 'AP VAT true-up — input VAT portion (by PO)',
    });
  } else if (netVat !== 0) {
    lines[0].debit = round2((lines[0].debit || 0) + netVat);
  }
  lines.push({
    accountId: ap.id,
    debit: netAp < 0 ? -netAp : 0,
    credit: netAp > 0 ? netAp : 0,
    description: 'AP VAT true-up — align subledger TTC',
  });

  const proposal = {
    storeId: NIPCO_STORE,
    date: DATE,
    memo: MEMO,
    sourceType: 'adjustment',
    sourceId: SOURCE_ID,
    event: EVENT,
    createdBy: CREATED_BY,
    lines,
    poDetail: PO_PIECES,
  };

  console.log(JSON.stringify(proposal, null, 2));
  if (dryRun) {
    console.log('\nDRY-RUN — no write.');
    return;
  }

  const result = await postJournalEntry(
    {
      storeId: NIPCO_STORE,
      date: DATE,
      memo: MEMO,
      sourceType: 'adjustment',
      sourceId: SOURCE_ID,
      event: EVENT,
      createdBy: CREATED_BY,
      lines,
    },
    map,
  );
  console.log('Posted', result);
}

function assertBalanced(inv, vat, ap) {
  const d = round2((inv > 0 ? inv : 0) + (vat > 0 ? vat : 0) + (ap < 0 ? -ap : 0));
  const c = round2((inv < 0 ? -inv : 0) + (vat < 0 ? -vat : 0) + (ap > 0 ? ap : 0));
  if (d !== c) throw new Error(`Unbalanced proposal d=${d} c=${c}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
