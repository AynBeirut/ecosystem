#!/usr/bin/env node
/**
 * Reverse fuzzy payroll overlap expense-side entries for little hands.
 * salaryPayments is authoritative; expense docs stay for audit, GL offset via reversal JE.
 */
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const STORE_ID = '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const CLEANUP_BY = 'cursor-payroll-cleanup-fuzzy';
const CLEANUP_REASON = 'fuzzy_payroll_expense_amount_mismatch';

const TARGETS = [
  {
    expenseId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-10',
    salaryId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-6',
    label: 'Thaer Delivery (2025-12-31 to 2026-01-30)',
  },
  {
    expenseId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-2',
    salaryId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-17',
    label: 'Marleine Sayegh (2026-02-01 to 2026-02-28)',
  },
  {
    expenseId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-11',
    salaryId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-16',
    label: 'Marleine Sayegh (2026-02-28 to 2026-03-30)',
  },
  {
    expenseId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-3',
    salaryId: 'pos-8WgfKtgaE8aAXdqFhIfweEo5WFq2-15',
    label: 'Amal Malek (2026-02-28 to 2026-03-30)',
  },
];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function initAdmin() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  return admin.firestore();
}

async function loadTrialBalance(db) {
  const [accountsSnap, entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
  ]);

  const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const postedEntryIds = new Set(
    entriesSnap.docs
      .map((d) => d.data())
      .filter((e) => e.status === 'posted')
      .map((e) => e.id),
  );

  const sums = new Map();
  for (const lineDoc of linesSnap.docs) {
    const line = lineDoc.data();
    if (!postedEntryIds.has(line.entryId)) continue;
    const prev = sums.get(line.accountId) || { debit: 0, credit: 0 };
    prev.debit += Number(line.debit || 0);
    prev.credit += Number(line.credit || 0);
    sums.set(line.accountId, prev);
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const rows = [];
  for (const account of accounts) {
    const sum = sums.get(account.id) || { debit: 0, credit: 0 };
    const debit = round2(sum.debit);
    const credit = round2(sum.credit);
    const normal = account.normalBalance === 'credit' ? 'credit' : 'debit';
    const balance =
      normal === 'credit' ? round2(credit - debit) : round2(debit - credit);
    totalDebit += debit;
    totalCredit += credit;
    if (debit !== 0 || credit !== 0) {
      rows.push({ code: account.code, name: account.name, debit, credit, balance });
    }
  }

  return {
    balanced: round2(totalDebit) === round2(totalCredit),
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    rows: rows.sort((a, b) => String(a.code).localeCompare(String(b.code))),
  };
}

async function findOriginalExpenseEntry(db, expenseId) {
  const paidKey = `expense:${expenseId}:paid`;
  const paidSnap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalEntries')
    .where('sourceKey', '==', paidKey)
    .limit(1)
    .get();
  if (!paidSnap.empty) return { id: paidSnap.docs[0].id, ...paidSnap.docs[0].data() };

  const bySource = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalEntries')
    .where('sourceId', '==', expenseId)
    .where('status', '==', 'posted')
    .get();
  const candidates = bySource.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => String(e.sourceKey || '').endsWith(':paid'));
  if (candidates.length === 1) return candidates[0];
  throw new Error(`Original posted expense journal not found for ${expenseId}`);
}

async function findExistingReversal(db, expenseId, originalEntryId) {
  const sourceKey = `expense:${expenseId}:reversal-duplicate-payroll-expense-cleanup-${originalEntryId}`;
  const snap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalEntries')
    .where('sourceKey', '==', sourceKey)
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function reverseExpense(db, target, cleanupAt) {
  const expenseRef = db.collection('expenses').doc(target.expenseId);
  const expenseSnap = await expenseRef.get();
  if (!expenseSnap.exists) throw new Error(`Missing expense ${target.expenseId}`);
  const expense = expenseSnap.data();

  if (expense.duplicateCleanupReversalEntryId) {
    return {
      expenseId: target.expenseId,
      skipped: true,
      reversalEntryId: expense.duplicateCleanupReversalEntryId,
      label: target.label,
    };
  }

  const original = await findOriginalExpenseEntry(db, target.expenseId);
  const existing = await findExistingReversal(db, target.expenseId, original.id);
  if (existing) {
    await expenseRef.set(
      {
        duplicateCleanupReason: CLEANUP_REASON,
        duplicateCleanupOriginalJournalEntryId: original.id,
        duplicateCleanupReversalEntryId: existing.id,
        duplicateCleanupKeptSalaryPaymentId: target.salaryId,
        duplicateCleanupBy: CLEANUP_BY,
        duplicateCleanupAt: cleanupAt,
      },
      { merge: true },
    );
    return {
      expenseId: target.expenseId,
      skipped: true,
      reversalEntryId: existing.id,
      label: target.label,
    };
  }

  const linesSnap = await db
    .collection('stores')
    .doc(STORE_ID)
    .collection('journalLines')
    .where('entryId', '==', original.id)
    .get();
  const origLines = linesSnap.docs.map((d) => d.data()).sort((a, b) => a.lineOrder - b.lineOrder);
  if (!origLines.length) throw new Error(`No journal lines for ${original.id}`);

  const reversalEntryId = `JE-${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const sourceKey = `expense:${target.expenseId}:reversal-duplicate-payroll-expense-cleanup-${original.id}`;
  const keyRef = db.collection('stores').doc(STORE_ID).collection('journalEntryKeys').doc(sourceKey);
  const entryRef = db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(reversalEntryId);
  const origEntryRef = db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(original.id);

  const cleanupMeta = {
    duplicateCleanupReason: CLEANUP_REASON,
    duplicateCleanupOriginalJournalEntryId: original.id,
    duplicateCleanupKeptSalaryPaymentId: target.salaryId,
    duplicateCleanupBy: CLEANUP_BY,
    duplicateCleanupAt: cleanupAt,
    duplicateCleanupOriginalSourceId: target.expenseId,
  };

  await db.runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) return;

    tx.set(entryRef, {
      id: reversalEntryId,
      storeId: STORE_ID,
      date: cleanupAt,
      memo: `Reverse duplicate expense entry ${target.expenseId}`,
      status: 'posted',
      sourceType: 'expense',
      sourceId: target.expenseId,
      sourceKey,
      currency: original.currency || 'USD',
      createdAt: cleanupAt,
      updatedAt: cleanupAt,
      createdBy: CLEANUP_BY,
      ...cleanupMeta,
      duplicateCleanupReversalEntryId: reversalEntryId,
    });

    origLines.forEach((line, index) => {
      const lineRef = db.collection('stores').doc(STORE_ID).collection('journalLines').doc(`${reversalEntryId}-L${index + 1}`);
      tx.set(lineRef, {
        id: `${reversalEntryId}-L${index + 1}`,
        storeId: STORE_ID,
        entryId: reversalEntryId,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        currency: line.currency || original.currency || 'USD',
        debit: round2(line.credit),
        credit: round2(line.debit),
        description: `Reverse duplicate ${original.id}: ${line.description || ''}`.trim(),
        lineOrder: index,
      });
    });

    tx.set(keyRef, {
      storeId: STORE_ID,
      sourceKey,
      entryId: reversalEntryId,
      createdAt: cleanupAt,
      updatedAt: cleanupAt,
    });

    tx.set(
      origEntryRef,
      {
        ...cleanupMeta,
        duplicateCleanupReversalEntryId: reversalEntryId,
      },
      { merge: true },
    );

    tx.set(
      expenseRef,
      {
        ...cleanupMeta,
        duplicateCleanupReversalEntryId: reversalEntryId,
        glPostingStatus: expense.glPostingStatus || 'posted',
      },
      { merge: true },
    );
  });

  return {
    expenseId: target.expenseId,
    label: target.label,
    skipped: false,
    originalEntryId: original.id,
    reversalEntryId,
    expenseAmount: round2(expense.amount),
    sourceKey,
  };
}

async function main() {
  const db = initAdmin();
  const tbBefore = await loadTrialBalance(db);
  console.log('TB BEFORE', JSON.stringify({ balanced: tbBefore.balanced, totalDebit: tbBefore.totalDebit, totalCredit: tbBefore.totalCredit }));

  const cleanupAt = new Date().toISOString();
  const results = [];
  for (const target of TARGETS) {
    const result = await reverseExpense(db, target, cleanupAt);
    results.push(result);
    console.log('RESULT', JSON.stringify(result));
    await new Promise((r) => setTimeout(r, 5));
  }

  const tbAfter = await loadTrialBalance(db);
  console.log('TB AFTER', JSON.stringify({ balanced: tbAfter.balanced, totalDebit: tbAfter.totalDebit, totalCredit: tbAfter.totalCredit }));

  const expense6099 = tbAfter.rows.find((r) => r.code === '6099');
  const cash1000 = tbAfter.rows.find((r) => r.code === '1000');
  console.log(
    'KEY ACCOUNTS',
    JSON.stringify({
      acct6099: expense6099 || null,
      acct1000: cash1000 || null,
    }),
  );

  console.log('SUMMARY', JSON.stringify({ results, tbBefore, tbAfter }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
