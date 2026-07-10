#!/usr/bin/env node
/**
 * GL Phase 1 E2E: seed COA → post balanced manual journal → trial balance (debits = credits).
 *
 * Usage:
 *   node scripts/verifyGlPhase1E2E.cjs
 *   node scripts/verifyGlPhase1E2E.cjs --keep
 */
const admin = require('firebase-admin');
const path = require('path');

const KEEP = process.argv.includes('--keep');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const db = admin.firestore();
const testRunId = `gl-phase1-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const DEFAULT_SMB_COA = [
  { code: '1000', name: 'Cash on Hand', type: 'asset', normalBalance: 'debit' },
  { code: '1010', name: 'Bank', type: 'asset', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '1201', name: 'Finished Goods Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2100', name: 'Sales Tax Payable', type: 'liability', normalBalance: 'credit' },
  { code: '3000', name: "Owner's Equity", type: 'equity', normalBalance: 'credit' },
  { code: '3100', name: 'Opening Balance Equity', type: 'equity', normalBalance: 'credit' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit' },
  { code: '6000', name: 'Rent Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6010', name: 'Utilities Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6020', name: 'Payroll Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6099', name: 'General Expense', type: 'expense', normalBalance: 'debit' },
];

function nowIso() { return new Date().toISOString(); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function ledgerAccountDocId(code) { return `acct-${code}`; }
function buildSourceKey(sourceType, sourceId, event) { return `${sourceType}:${sourceId}:${event}`; }

async function seedCoa() {
  const ts = nowIso();
  const batch = db.batch();
  const accounts = [];
  for (const row of DEFAULT_SMB_COA) {
    const id = ledgerAccountDocId(row.code);
    const account = {
      id, storeId, code: row.code, name: row.name, type: row.type,
      normalBalance: row.normalBalance, isSystem: true, isActive: true,
      openingBalance: 0, createdAt: ts, updatedAt: ts,
    };
    accounts.push(account);
    batch.set(db.collection('stores').doc(storeId).collection('ledgerAccounts').doc(id), account);
  }
  batch.set(db.collection('stores').doc(storeId).collection('ledgerMeta').doc('coa'), {
    storeId, initialized: true, accountCount: accounts.length, createdAt: ts, updatedAt: ts,
  });
  await batch.commit();
  return accounts;
}

async function findEntryBySourceKey(sourceKey) {
  const snap = await db.collection('stores').doc(storeId).collection('journalEntries')
    .where('sourceKey', '==', sourceKey).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function postJournalEntry({ date, memo, sourceType, sourceId, event, lines }, accountsById) {
  const sourceKey = buildSourceKey(sourceType, sourceId, event);
  const existing = await findEntryBySourceKey(sourceKey);
  if (existing) return { entryId: existing.id, sourceKey, idempotentReplay: true };

  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    debitTotal += round2(line.debit || 0);
    creditTotal += round2(line.credit || 0);
  }
  assert(round2(debitTotal) === round2(creditTotal), `Unbalanced: ${debitTotal} vs ${creditTotal}`);

  const entryId = `JE-${Date.now()}`;
  const now = nowIso();
  const entry = {
    id: entryId, storeId, date, memo, status: 'posted', sourceType, sourceId, sourceKey,
    currency: 'USD', createdAt: now, updatedAt: now,
  };

  const batch = db.batch();
  batch.set(db.collection('stores').doc(storeId).collection('journalEntries').doc(entryId), entry);

  lines.forEach((line, index) => {
    const account = accountsById.get(line.accountId);
    assert(account, `Missing account ${line.accountId}`);
    const lineDoc = {
      id: `${entryId}-L${index + 1}`,
      storeId, entryId, accountId: account.id,
      accountCode: account.code, accountName: account.name,
      debit: round2(line.debit || 0), credit: round2(line.credit || 0),
      lineOrder: index,
    };
    batch.set(db.collection('stores').doc(storeId).collection('journalLines').doc(lineDoc.id), lineDoc);
  });

  await batch.commit();
  return { entryId, sourceKey, idempotentReplay: false };
}

function trialBalanceForAccount(account, debitSum, creditSum) {
  const opening = round2(account.openingBalance || 0);
  let d = debitSum;
  let c = creditSum;
  if (opening !== 0) {
    if (account.normalBalance === 'debit') d += opening;
    else c += opening;
  }
  if (account.normalBalance === 'debit') {
    const balance = round2(d - c);
    return balance >= 0 ? { debit: balance, credit: 0 } : { debit: 0, credit: -balance };
  }
  const balance = round2(c - d);
  return balance >= 0 ? { debit: 0, credit: balance } : { debit: -balance, credit: 0 };
}

function buildTrialBalance(accounts, entries, lines, endDate) {
  const postedEntryIds = new Set(
    entries.filter((e) => e.status === 'posted' && e.date.slice(0, 10) <= endDate.slice(0, 10)).map((e) => e.id),
  );
  const sums = new Map();
  for (const line of lines) {
    if (!postedEntryIds.has(line.entryId)) continue;
    const cur = sums.get(line.accountId) || { debit: 0, credit: 0 };
    cur.debit = round2(cur.debit + (line.debit || 0));
    cur.credit = round2(cur.credit + (line.credit || 0));
    sums.set(line.accountId, cur);
  }

  const rows = [];
  for (const account of accounts.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code))) {
    const sum = sums.get(account.id) || { debit: 0, credit: 0 };
    const tb = trialBalanceForAccount(account, sum.debit, sum.credit);
    if (tb.debit === 0 && tb.credit === 0) continue;
    rows.push({
      accountId: account.id, accountCode: account.code, accountName: account.name,
      accountType: account.type, debit: tb.debit, credit: tb.credit,
    });
  }

  const totalDebits = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredits = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDebits, totalCredits, balanced: totalDebits === totalCredits };
}

async function loadBundle() {
  const [acctSnap, entrySnap, lineSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
    db.collection('stores').doc(storeId).collection('journalEntries').get(),
    db.collection('stores').doc(storeId).collection('journalLines').get(),
  ]);
  return {
    accounts: acctSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entrySnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lines: lineSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function cleanup() {
  const cols = ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta'];
  for (const col of cols) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
  await db.collection('stores').doc(storeId).delete().catch(() => {});
}

async function main() {
  const results = [];
  let pass = 0;
  let fail = 0;

  function check(name, cond, detail = '') {
    if (cond) { pass++; results.push(`PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
    else { fail++; results.push(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
    assert(cond, `${name} failed${detail ? `: ${detail}` : ''}`);
  }

  try {
    console.log(`\n=== GL Phase 1 E2E ===`);
    console.log(`Store: ${storeId}\n`);

    const accounts = await seedCoa();
    check('COA seeded', accounts.length === DEFAULT_SMB_COA.length, `${accounts.length} accounts`);

    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const cash = accounts.find((a) => a.code === '1000');
    const revenue = accounts.find((a) => a.code === '4000');
    check('Cash account exists', !!cash);
    check('Revenue account exists', !!revenue);

    const manualAmount = 250.5;
    const post1 = await postJournalEntry({
      date: nowIso(),
      memo: 'E2E manual journal',
      sourceType: 'manual',
      sourceId: `manual-${testRunId}`,
      event: 'post',
      lines: [
        { accountId: cash.id, debit: manualAmount, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: manualAmount },
      ],
    }, accountsById);
    check('Manual entry posted', !post1.idempotentReplay, post1.entryId);

    const post2 = await postJournalEntry({
      date: nowIso(),
      memo: 'E2E manual journal',
      sourceType: 'manual',
      sourceId: `manual-${testRunId}`,
      event: 'post',
      lines: [
        { accountId: cash.id, debit: manualAmount, credit: 0 },
        { accountId: revenue.id, debit: 0, credit: manualAmount },
      ],
    }, accountsById);
    check('Idempotent replay', post2.idempotentReplay === true, post2.entryId);

    const bundle = await loadBundle();
    check('Journal entries count', bundle.entries.length === 1, String(bundle.entries.length));
    check('Journal lines count', bundle.lines.length === 2, String(bundle.lines.length));

    const tb = buildTrialBalance(bundle.accounts, bundle.entries, bundle.lines, nowIso().slice(0, 10));
    check('Trial balance debits = credits', tb.balanced, `${tb.totalDebits} = ${tb.totalCredits}`);
    check('TB cash debit', tb.rows.some((r) => r.accountCode === '1000' && r.debit === manualAmount));
    check('TB revenue credit', tb.rows.some((r) => r.accountCode === '4000' && r.credit === manualAmount));

    console.log('\n--- Results ---');
    results.forEach((r) => console.log(r));
    console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
    console.log(`Trial Balance: debits ${tb.totalDebits} | credits ${tb.totalCredits} | balanced=${tb.balanced}`);

    if (!KEEP) {
      await cleanup();
      console.log('\nCleanup: test store removed.');
    } else {
      console.log(`\n--keep: store ${storeId} retained for inspection.`);
    }

    process.exit(fail > 0 ? 1 : 0);
  } catch (err) {
    console.error('\nE2E ABORTED:', err.message);
    if (!KEEP) await cleanup().catch(() => {});
    process.exit(1);
  }
}

main();
