#!/usr/bin/env node
/**
 * Reclass mis-posted expense lines on Grabio 799 → COGS / payroll / utilities / rent.
 * Fixes POS "Bill Payment" and "staff_wages" defaulting to miscellaneous expense.
 *
 *   node scripts/reclassStoreExpense799.cjs --store-id=STORE_ID --dry-run
 *   node scripts/reclassStoreExpense799.cjs --store-id=STORE_ID --write
 *   node scripts/reclassStoreExpense799.cjs --all-targets --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const TARGET_STORES = {
  littleHands: '8WgfKtgaE8aAXdqFhIfweEo5WFq2',
  nipco: 'DfIhBAEZ5NR7yNX0HboZvv58Nf82',
  jinan: 'ujff7blWYvUvlekQOrybvNCnn9V2',
  goGrow: 'p5zesYQXZRRYA3wKUxjfVCqxQQo1',
};

const FROM_CODE = '799';
const SOURCE_TAG = 'expense-reclass-799-2026-08-16';

const GL = { COGS: '501', PAYROLL: '601', UTILITIES: '612', RENT: '610', MISC: '799' };

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
  return String(category || '').toLowerCase().trim();
}

function categoryKey(category) {
  return normalizeCategory(category).replace(/_/g, ' ');
}

function resolveExpenseAccountCode({ category, vendor, description }) {
  const cat = normalizeCategory(category);
  const catSpaced = categoryKey(category);
  const hay = `${vendor || ''} ${description || ''}`.toLowerCase();
  if (catSpaced === 'bill payment') {
    if (UTILITIES_VENDOR.test(hay)) return GL.UTILITIES;
    if (RENT_VENDOR.test(hay)) return GL.RENT;
    return GL.COGS;
  }
  return BASE_MAP[cat] || BASE_MAP[catSpaced] || GL.MISC;
}

function initAdmin() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  return admin.firestore();
}

function parseStoreIds() {
  if (process.argv.includes('--all-targets')) return Object.values(TARGET_STORES);
  const ids = process.argv
    .filter((a) => a.startsWith('--store-id='))
    .map((a) => a.split('=')[1])
    .filter(Boolean);
  if (ids.length) return ids;
  console.error('Usage: --store-id=ID [--write]  OR  --all-targets [--write]');
  process.exit(1);
}

async function reclassStore(db, storeId) {
  const [accountsSnap, entriesSnap, linesSnap, expensesSnap] = await Promise.all([
    db.collection('stores').doc(storeId).collection('ledgerAccounts').get(),
    db.collection('stores').doc(storeId).collection('journalEntries').get(),
    db.collection('stores').doc(storeId).collection('journalLines').get(),
    db.collection('expenses').where('storeId', '==', storeId).get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  const miscAcct = accountByCode.get(FROM_CODE);
  if (!miscAcct) {
    return { storeId, skipped: true, reason: 'no 799 account' };
  }

  const expenseById = new Map(expensesSnap.docs.map((d) => [d.id, d.data()]));
  const postedEntryIds = new Set(
    entriesSnap.docs.filter((d) => d.data().status === 'posted').map((d) => d.id),
  );
  const entryById = new Map(entriesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const updates = [];
  const summary = { c501: 0, c601: 0, c612: 0, c610: 0, skipped: 0, lines: 0 };

  for (const lineDoc of linesSnap.docs) {
    const line = lineDoc.data();
    if (line.accountId !== miscAcct.id) continue;
    if (!postedEntryIds.has(line.entryId)) continue;
    if (line.reclassSourceTag === SOURCE_TAG) continue;

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
    if (!targetAcct) {
      throw new Error(`${storeId}: missing target account ${targetCode}`);
    }

    const amount = round2(Math.max(Number(line.debit || 0), Number(line.credit || 0)));
    if (amount <= 0) continue;

    updates.push({
      lineId: lineDoc.id,
      toCode: targetCode,
      toAccountId: targetAcct.id,
      amount,
    });
    summary[`c${targetCode}`] = (summary[`c${targetCode}`] || 0) + amount;
    summary.lines += 1;
  }

  if (!dryRun && updates.length > 0) {
    let batch = db.batch();
    let ops = 0;
    for (const row of updates) {
      batch.update(db.collection('stores').doc(storeId).collection('journalLines').doc(row.lineId), {
        accountId: row.toAccountId,
        accountCode: row.toCode,
        reclassSourceTag: SOURCE_TAG,
        reclassFromCode: FROM_CODE,
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

    await db.collection('stores').doc(storeId).collection('ledgerMeta').doc('expenseReclass799').set(
      { tag: SOURCE_TAG, appliedAt: admin.firestore.FieldValue.serverTimestamp(), linesUpdated: updates.length, summary },
      { merge: true },
    );
  }

  return { storeId, updates: updates.length, summary };
}

async function main() {
  const db = initAdmin();
  const storeIds = parseStoreIds();
  console.log(`\n=== Expense 799 reclass (${dryRun ? 'DRY RUN' : 'WRITE'}) ===`);

  const results = [];
  for (const storeId of storeIds) {
    const result = await reclassStore(db, storeId);
    results.push(result);
    if (result.skipped) {
      console.log(`${storeId}: skipped (${result.reason})`);
      continue;
    }
    console.log(
      `${storeId}: ${result.updates} lines → 501:${round2(result.summary.c501 || 0)} 601:${round2(result.summary.c601 || 0)} 612:${round2(result.summary.c612 || 0)} skip:${result.summary.skipped}`,
    );
  }

  const reportPath = path.join(
    process.cwd(),
    'backups',
    `expense-reclass-799-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ dryRun, results }, null, 2));
  console.log(`Report: ${reportPath}`);
  if (dryRun) console.log('\nRun with --write to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
