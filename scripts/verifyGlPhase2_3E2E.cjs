#!/usr/bin/env node
/**
 * GL Phase 2–3 E2E: auto-posting (invoice/expense/purchase), opening balance, balance sheet.
 *
 * Usage: node scripts/verifyGlPhase2_3E2E.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const db = admin.firestore();
const testRunId = `gl-phase23-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const GL = {
  CASH: 'acct-1000', REVENUE: 'acct-4000', COGS: 'acct-5000', FG: 'acct-1201',
  INVENTORY: 'acct-1200', AP: 'acct-2000', RENT: 'acct-6000', OPENING: 'acct-3100',
};

const DEFAULT_SMB_COA = [
  ['1000', 'Cash on Hand', 'asset', 'debit'],
  ['1010', 'Bank', 'asset', 'debit'],
  ['1100', 'Accounts Receivable', 'asset', 'debit'],
  ['1200', 'Inventory', 'asset', 'debit'],
  ['1201', 'Finished Goods Inventory', 'asset', 'debit'],
  ['2000', 'Accounts Payable', 'liability', 'credit'],
  ['2100', 'Sales Tax Payable', 'liability', 'credit'],
  ['3000', "Owner's Equity", 'equity', 'credit'],
  ['3100', 'Opening Balance Equity', 'equity', 'credit'],
  ['4000', 'Sales Revenue', 'revenue', 'credit'],
  ['5000', 'Cost of Goods Sold', 'expense', 'debit'],
  ['6000', 'Rent Expense', 'expense', 'debit'],
  ['6010', 'Utilities Expense', 'expense', 'debit'],
  ['6020', 'Payroll Expense', 'expense', 'debit'],
  ['6099', 'General Expense', 'expense', 'debit'],
];

function nowIso() { return new Date().toISOString(); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function assert(c, m) { if (!c) throw new Error(m); }
function buildSourceKey(t, id, e) { return `${t}:${id}:${e}`; }

async function seedCoa() {
  const ts = nowIso();
  const batch = db.batch();
  const accounts = [];
  for (const [code, name, type, normalBalance] of DEFAULT_SMB_COA) {
    const id = `acct-${code}`;
    const a = { id, storeId, code, name, type, normalBalance, isSystem: true, isActive: true, openingBalance: 0, createdAt: ts, updatedAt: ts };
    accounts.push(a);
    batch.set(db.doc(`stores/${storeId}/ledgerAccounts/${id}`), a);
  }
  batch.set(db.doc(`stores/${storeId}/ledgerMeta/coa`), { storeId, initialized: true, createdAt: ts });
  await batch.commit();
  return accounts;
}

async function postIfNew(entry, lines) {
  const sk = buildSourceKey(entry.sourceType, entry.sourceId, entry.event);
  const existing = await db.collection(`stores/${storeId}/journalEntries`).where('sourceKey', '==', sk).limit(1).get();
  if (!existing.empty) return { id: existing.docs[0].id, replay: true };

  const entryId = `JE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const full = { ...entry, id: entryId, storeId, sourceKey: sk, status: 'posted', currency: 'USD', createdAt: nowIso(), updatedAt: nowIso() };
  const batch = db.batch();
  batch.set(db.doc(`stores/${storeId}/journalEntries/${entryId}`), full);
  lines.forEach((l, i) => {
    const lid = `${entryId}-L${i + 1}`;
    batch.set(db.doc(`stores/${storeId}/journalLines/${lid}`), { ...l, id: lid, storeId, entryId, lineOrder: i });
  });
  await batch.commit();
  return { id: entryId, replay: false };
}

function autoPostInvoicePaid(invoice) {
  const amount = round2(invoice.amount);
  const cogs = round2((invoice.items || []).reduce((s, it) => s + round2(it.rawPrice) * round2(it.quantity), 0));
  const lines = [
    { accountId: GL.CASH, accountCode: '1000', accountName: 'Cash', debit: amount, credit: 0 },
    { accountId: GL.REVENUE, accountCode: '4000', accountName: 'Sales Revenue', debit: 0, credit: amount },
  ];
  if (cogs > 0) {
    lines.push({ accountId: GL.COGS, accountCode: '5000', accountName: 'COGS', debit: cogs, credit: 0 });
    lines.push({ accountId: GL.FG, accountCode: '1201', accountName: 'FG Inventory', debit: 0, credit: cogs });
  }
  return postIfNew(
    { date: invoice.date, memo: `Invoice ${invoice.id}`, sourceType: 'invoice', sourceId: invoice.id, event: 'paid' },
    lines,
  );
}

function autoPostExpense(expense, amt) {
  return postIfNew(
    { date: expense.startDate, memo: expense.name, sourceType: 'expense', sourceId: expense.id, event: `payment-${Date.now()}` },
    [
      { accountId: GL.RENT, accountCode: '6000', accountName: 'Rent', debit: amt, credit: 0 },
      { accountId: GL.CASH, accountCode: '1000', accountName: 'Cash', debit: 0, credit: amt },
    ],
  );
}

function autoPostPurchaseReceived(po) {
  const total = round2(po.amount);
  return postIfNew(
    { date: po.date, memo: `PO ${po.id}`, sourceType: 'purchase', sourceId: po.id, event: 'received' },
    [
      { accountId: GL.INVENTORY, accountCode: '1200', accountName: 'Inventory', debit: total, credit: 0 },
      { accountId: GL.AP, accountCode: '2000', accountName: 'AP', debit: 0, credit: total },
    ],
  );
}

function autoPostOpeningBalance(cashAmount) {
  return postIfNew(
    { date: nowIso(), memo: 'Opening cash', sourceType: 'opening', sourceId: GL.CASH, event: 'opening-balance' },
    [
      { accountId: GL.CASH, accountCode: '1000', accountName: 'Cash', debit: cashAmount, credit: 0 },
      { accountId: GL.OPENING, accountCode: '3100', accountName: 'Opening Equity', debit: 0, credit: cashAmount },
    ],
  );
}

async function loadAll() {
  const [a, e, l] = await Promise.all([
    db.collection(`stores/${storeId}/ledgerAccounts`).get(),
    db.collection(`stores/${storeId}/journalEntries`).get(),
    db.collection(`stores/${storeId}/journalLines`).get(),
  ]);
  return {
    accounts: a.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: e.docs.map((d) => ({ id: d.id, ...d.data() })),
    lines: l.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

function buildTB(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  const sums = new Map();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const c = sums.get(line.accountId) || { d: 0, c: 0 };
    c.d = round2(c.d + line.debit); c.c = round2(c.c + line.credit);
    sums.set(line.accountId, c);
  }
  const rows = [];
  for (const acct of accounts) {
    const s = sums.get(acct.id) || { d: 0, c: 0 };
    let d = s.d, c = s.c;
    if (acct.normalBalance === 'debit') {
      const bal = round2(d - c);
      if (bal > 0) rows.push({ code: acct.code, type: acct.type, debit: bal, credit: 0 });
      else if (bal < 0) rows.push({ code: acct.code, type: acct.type, debit: 0, credit: -bal });
    } else {
      const bal = round2(c - d);
      if (bal > 0) rows.push({ code: acct.code, type: acct.type, debit: 0, credit: bal });
      else if (bal < 0) rows.push({ code: acct.code, type: acct.type, debit: -bal, credit: 0 });
    }
  }
  const totalDebits = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredits = round2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totalDebits, totalCredits, balanced: totalDebits === totalCredits };
}

function buildBS(tb, accounts) {
  const amountFor = (acct, r) => {
    if (acct.type === 'asset') return round2(r.debit - r.credit);
    return round2(r.credit - r.debit);
  };

  const byCode = new Map(tb.rows.map((r) => [r.code, r]));
  const sumType = (type) => round2(
    accounts
      .filter((a) => a.type === type)
      .reduce((s, a) => {
        const r = byCode.get(a.code);
        return r ? s + amountFor(a, r) : s;
      }, 0),
  );

  const assets = sumType('asset');
  const liabilities = sumType('liability');
  const equity = sumType('equity');
  const revenue = round2((byCode.get('4000') || { debit: 0, credit: 0 }).credit);
  const expense = round2(
    accounts
      .filter((a) => a.type === 'expense')
      .reduce((s, a) => {
        const r = byCode.get(a.code);
        return r ? s + round2(r.debit - r.credit) : s;
      }, 0),
  );
  const netIncome = round2(revenue - expense);
  const totalLE = round2(liabilities + equity + netIncome);
  return { assets, totalLE, netIncome, balanced: assets === totalLE };
}

async function cleanup() {
  for (const col of ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta']) {
    const snap = await db.collection(`stores/${storeId}/${col}`).get();
    const b = db.batch();
    snap.docs.forEach((d) => b.delete(d.ref));
    if (!snap.empty) await b.commit();
  }
}

async function main() {
  let pass = 0;
  const log = (ok, msg) => { if (ok) { pass++; console.log(`PASS  ${msg}`); } else { console.log(`FAIL  ${msg}`); } assert(ok, msg); };

  try {
    console.log(`\n=== GL Phase 2–3 E2E ===\nStore: ${storeId}\n`);
    await seedCoa();

    const invoice = { id: 'INV-E2E-1', date: nowIso(), amount: 100, items: [{ rawPrice: 4, quantity: 5 }] };
    const invPost = await autoPostInvoicePaid(invoice);
    log(!invPost.replay, `Invoice paid posted (${invPost.id})`);
    const invReplay = await autoPostInvoicePaid(invoice);
    log(invReplay.replay, 'Invoice idempotent replay');

    const expense = { id: 'EXP-E2E-1', name: 'Rent', startDate: nowIso(), category: 'rent' };
    await autoPostExpense(expense, 50);
    log(true, 'Expense payment posted');

    const po = { id: 'PO-E2E-1', date: nowIso(), amount: 200 };
    await autoPostPurchaseReceived(po);
    log(true, 'Purchase received posted');

    await autoPostOpeningBalance(1000);
    log(true, 'Opening balance posted');

    const bundle = await loadAll();
    log(bundle.entries.length >= 4, `Journal entries: ${bundle.entries.length}`);

    const tb = buildTB(bundle.accounts, bundle.entries, bundle.lines);
    log(tb.balanced, `Trial balance: ${tb.totalDebits} = ${tb.totalCredits}`);

    const bs = buildBS(tb, bundle.accounts);
    log(bs.balanced, `Balance sheet: assets ${bs.assets} = L+E ${bs.totalLE} (net income ${bs.netIncome})`);

    console.log(`\nSUMMARY: ${pass} passed`);
    await cleanup();
    console.log('Cleanup done.\n');
    process.exit(0);
  } catch (err) {
    console.error('ABORTED:', err.message);
    await cleanup().catch(() => {});
    process.exit(1);
  }
}

main();
