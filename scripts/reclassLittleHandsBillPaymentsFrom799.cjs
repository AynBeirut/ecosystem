#!/usr/bin/env node
/**
 * Little Hands — reclass POS bill payments (and staff_wages) posted to 799 → correct COA.
 *
 *   node scripts/reclassLittleHandsBillPaymentsFrom799.cjs --dry-run
 *   node scripts/reclassLittleHandsBillPaymentsFrom799.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const FROM_CODE = '799';
const SOURCE_TAG = 'littlehands-expense-reclass-799-2026-08-16';

const GL = {
  COGS: '501',
  PAYROLL: '601',
  UTILITIES: '612',
  RENT: '610',
  MISC: '799',
};

const BASE_MAP = {
  rent: GL.RENT,
  utilities: GL.UTILITIES,
  payroll: GL.PAYROLL,
  staff_wages: GL.PAYROLL,
  meals: GL.COGS,
  office_supplies: GL.COGS,
  fuel: '613',
  internet: '622',
  maintenance: '613',
  marketing: GL.MISC,
  insurance: GL.MISC,
  legal: GL.MISC,
  travel: GL.MISC,
  other: GL.MISC,
};

const UTILITIES_VENDOR = /edl|electric|électric|zir electric|generator|diesel|kahraba/i;
const RENT_VENDOR = /rent|lease|إيجار/i;

const dryRun = !process.argv.includes('--write');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function normalizeCategory(category) {
  return String(category || '')
    .toLowerCase()
    .trim()
    .replace(/_/g, ' ');
}

function resolveExpenseAccountCode({ category, vendor, description }) {
  const cat = normalizeCategory(category);
  const hay = `${vendor || ''} ${description || ''}`.toLowerCase();
  if (cat === 'bill payment') {
    if (UTILITIES_VENDOR.test(hay)) return GL.UTILITIES;
    if (RENT_VENDOR.test(hay)) return GL.RENT;
    return GL.COGS;
  }
  return BASE_MAP[cat] || GL.MISC;
}

function initAdmin() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  return admin.firestore();
}

async function main() {
  const db = initAdmin();
  const [accountsSnap, entriesSnap, linesSnap, expensesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
    db.collection('expenses').where('storeId', '==', STORE_ID).get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  const miscAcct = accountByCode.get(FROM_CODE);
  if (!miscAcct) throw new Error(`Missing account ${FROM_CODE}`);

  const expenseById = new Map(expensesSnap.docs.map((d) => [d.id, d.data()]));
  const postedEntryIds = new Set(
    entriesSnap.docs.filter((d) => d.data().status === 'posted').map((d) => d.id),
  );
  const entryById = new Map(entriesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const linesByEntry = new Map();
  for (const lineDoc of linesSnap.docs) {
    const line = { id: lineDoc.id, ...lineDoc.data() };
    const list = linesByEntry.get(line.entryId) || [];
    list.push(line);
    linesByEntry.set(line.entryId, list);
  }

  const updates = [];
  const summary = { c501: 0, c601: 0, c612: 0, c610: 0, skipped: 0, lines: 0 };

  for (const lineDoc of linesSnap.docs) {
    const line = lineDoc.data();
    if (line.accountId !== miscAcct.id) continue;
    if (!postedEntryIds.has(line.entryId)) continue;

    const entry = entryById.get(line.entryId);
    if (!entry || entry.sourceType !== 'expense') continue;

    const expenseId = String(entry.sourceId || '').trim();
    const expense = expenseById.get(expenseId);
    if (!expense) {
      summary.skipped += 1;
      continue;
    }

    const targetCode = resolveExpenseAccountCode({
      category: expense.category,
      vendor: expense.vendor,
      description: expense.description || entry.memo,
    });
    if (targetCode === FROM_CODE) {
      summary.skipped += 1;
      continue;
    }

    const targetAcct = accountByCode.get(targetCode);
    if (!targetAcct) throw new Error(`Missing target account ${targetCode}`);

    const amount = round2(Math.max(Number(line.debit || 0), Number(line.credit || 0)));
    if (amount <= 0) continue;

    updates.push({
      lineId: lineDoc.id,
      entryId: line.entryId,
      expenseId,
      fromCode: FROM_CODE,
      toCode: targetCode,
      toAccountId: targetAcct.id,
      amount,
      memo: entry.memo,
    });
    summary[`c${targetCode}`] = (summary[`c${targetCode}`] || 0) + amount;
    summary.lines += 1;
  }

  console.log(`\n=== Little Hands expense reclass (${dryRun ? 'DRY RUN' : 'WRITE'}) ===`);
  console.log(`Lines to update: ${updates.length}`);
  console.log(`→ 501 COGS: ${round2(summary.c501 || 0)}`);
  console.log(`→ 601 Payroll: ${round2(summary.c601 || 0)}`);
  console.log(`→ 612 Utilities: ${round2(summary.c612 || 0)}`);
  console.log(`→ 610 Rent: ${round2(summary.c610 || 0)}`);
  console.log(`Skipped (stay on 799): ${summary.skipped}`);

  const reportPath = path.join(
    process.cwd(),
    'backups',
    `littlehands-expense-reclass-799-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ storeId: STORE_ID, dryRun, summary, updates: updates.slice(0, 20), totalUpdates: updates.length }, null, 2),
  );
  console.log(`Report: ${reportPath}`);

  if (dryRun) {
    console.log('\nRun with --write to apply.');
    return;
  }

  let batch = db.batch();
  let ops = 0;
  for (const row of updates) {
    batch.update(db.collection('stores').doc(STORE_ID).collection('journalLines').doc(row.lineId), {
      accountId: row.toAccountId,
      accountCode: row.toCode,
      reclassSourceTag: SOURCE_TAG,
      reclassFromCode: row.fromCode,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  await db.collection('stores').doc(STORE_ID).collection('ledgerMeta').doc('expenseReclass799').set({
    tag: SOURCE_TAG,
    appliedAt: admin.firestore.FieldValue.serverTimestamp(),
    linesUpdated: updates.length,
    summary,
  }, { merge: true });

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
