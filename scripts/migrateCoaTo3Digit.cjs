#!/usr/bin/env node
/**
 * Migrate live store COA from legacy 4-digit codes to 3-digit standard (stable doc IDs).
 *
 * Usage:
 *   node scripts/migrateCoaTo3Digit.cjs --store-id=Av22LKyet8QmVcu9b8Njz1HVfoy1 --dry-run
 *   node scripts/migrateCoaTo3Digit.cjs --store-id=Av22LKyet8QmVcu9b8Njz1HVfoy1 --write
 */
const admin = require('firebase-admin');
const path = require('path');
const { STANDARD_COA, LEGACY_DOC_MIGRATIONS } = require('./coaStandardData.cjs');

const args = process.argv.slice(2);
const storeIdArg = args.find((a) => a.startsWith('--store-id='));
const storeId = storeIdArg ? storeIdArg.split('=')[1] : '';
const dryRun = args.includes('--dry-run') || !args.includes('--write');

if (!storeId) {
  console.error('Missing --store-id=');
  process.exit(1);
}

const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
}
const db = admin.firestore();

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function trialBalanceByAccountId(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  const sums = new Map();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const cur = sums.get(line.accountId) || { d: 0, c: 0 };
    cur.d += Number(line.debit) || 0;
    cur.c += Number(line.credit) || 0;
    sums.set(line.accountId, cur);
  }
  const rows = [];
  let totalD = 0;
  let totalC = 0;
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
    rows.push({ accountId: acct.id, code: acct.code, tbD, tbC });
    totalD += tbD;
    totalC += tbC;
  }
  return { rows, totalD: round2(totalD), totalC: round2(totalC), balanced: round2(totalD) === round2(totalC) };
}

async function loadGl(storeId) {
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
  console.log(`\nCOA 3-digit migration — store ${storeId} — ${dryRun ? 'DRY RUN' : 'WRITE'}\n`);

  const before = await loadGl(storeId);
  const tbBefore = trialBalanceByAccountId(before.accounts, before.entries, before.lines);
  console.log('TB BEFORE:', { totalDebits: tbBefore.totalD, totalCredits: tbBefore.totalC, balanced: tbBefore.balanced });

  const accountById = new Map(before.accounts.map((a) => [a.id, { ...a }]));
  const now = new Date().toISOString();
  const updates = [];

  for (const [docId, patch] of Object.entries(LEGACY_DOC_MIGRATIONS)) {
    const acct = accountById.get(docId);
    if (!acct) continue;
    const seed = STANDARD_COA.find((r) => r.code === patch.code);
    updates.push({
      ref: db.collection('stores').doc(storeId).collection('ledgerAccounts').doc(docId),
      data: {
        code: patch.code,
        name: patch.name,
        type: seed?.type || acct.type,
        normalBalance: seed?.normalBalance || acct.normalBalance,
        isSystem: true,
        isActive: true,
        updatedAt: now,
      },
    });
    acct.code = patch.code;
    acct.name = patch.name;
  }

  const existingCodes = new Set([...accountById.values()].map((a) => String(a.code)));
  for (const row of STANDARD_COA) {
    if (existingCodes.has(row.code)) continue;
    const id = `acct-${row.code}`;
    if (accountById.has(id)) continue;
    updates.push({
      ref: db.collection('stores').doc(storeId).collection('ledgerAccounts').doc(id),
      data: {
        id,
        storeId,
        code: row.code,
        name: row.name,
        type: row.type,
        normalBalance: row.normalBalance,
        isSystem: row.defaultActive,
        isActive: row.defaultActive,
        openingBalance: 0,
        createdAt: now,
        updatedAt: now,
      },
      create: true,
    });
    accountById.set(id, { id, ...updates[updates.length - 1].data });
    existingCodes.add(row.code);
  }

  const lineUpdates = [];
  for (const line of before.lines) {
    const acct = accountById.get(line.accountId);
    if (!acct) continue;
    if (line.accountCode === acct.code && line.accountName === acct.name) continue;
    lineUpdates.push({
      ref: db.collection('stores').doc(storeId).collection('journalLines').doc(line.id),
      data: { accountCode: acct.code, accountName: acct.name, updatedAt: now },
    });
    line.accountCode = acct.code;
    line.accountName = acct.name;
  }

  const tbAfter = trialBalanceByAccountId([...accountById.values()], before.entries, before.lines);
  console.log('TB AFTER (projected):', { totalDebits: tbAfter.totalD, totalCredits: tbAfter.totalC, balanced: tbAfter.balanced });
  console.log('Account doc updates:', updates.length, '| Line backfills:', lineUpdates.length);

  if (tbBefore.totalD !== tbAfter.totalD || tbBefore.totalC !== tbAfter.totalC) {
    console.error('❌ TB totals changed — aborting.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\nDry run complete — no writes.');
    return;
  }

  let batch = db.batch();
  let n = 0;
  for (const u of updates) {
    if (u.create) batch.set(u.ref, u.data);
    else batch.set(u.ref, u.data, { merge: true });
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  for (const u of lineUpdates) {
    batch.set(u.ref, u.data, { merge: true });
    n++;
    if (n >= 400) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  batch.set(
    db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa'),
    { storeId, coaVersion: '3digit-66', migratedAt: now, updatedAt: now },
    { merge: true },
  );
  await batch.commit();

  const after = await loadGl(storeId);
  const tbLive = trialBalanceByAccountId(after.accounts, after.entries, after.lines);
  console.log('TB LIVE:', tbLive);
  console.log('\n✅ Migration write complete.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
