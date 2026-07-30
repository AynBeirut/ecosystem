#!/usr/bin/env node
/**
 * Nipco — post missing purchase_payment GL (Dr 201 / Cr 102) from platform purchase paymentHistory.
 *
 *   node scripts/nipcoPostPurchasePaymentRelief.cjs --dry-run
 *   node scripts/nipcoPostPurchasePaymentRelief.cjs --write
 */
const fs = require('fs');
const path = require('path');
const admin = require('../functions/node_modules/firebase-admin');

const STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const CREATED_BY = 'cursor-nipco-purchase-payment-relief-2026-07';
const AP_CODE = '201';
const CASH_CODE = '102';

const dryRun = !process.argv.includes('--write');
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function initAdmin() {
  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  return admin.firestore();
}

const {
  ensureDefaultChartOfAccounts,
  postJournalEntry,
  accountsMap,
  buildSourceKey,
} = require('../functions/lib/lib/ledger/postingService');

function derivePaymentStatus(data, total) {
  const raw = String(data.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'unpaid' || raw === 'partial') return raw;
  const amountPaid = Number(data.amountPaid ?? 0) || 0;
  if (total > 0 && amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function paymentSlices(data, amountPaid) {
  const hist = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
  const rows = hist
    .map((p, idx) => ({
      id: String(p.id || `hist-${idx}`),
      amount: round2(Number(p.amount) || 0),
      date: String(p.date || p.paymentDate || data.paymentDate || new Date().toISOString()),
      method: p.method || p.paymentMethod || data.paymentMethod || 'cash',
    }))
    .filter((p) => p.amount > 0);
  if (rows.length) return rows;
  if (amountPaid > 0) {
    return [
      {
        id: 'aggregate',
        amount: amountPaid,
        date: String(data.paymentDate || data.receivedDate || data.orderDate || new Date().toISOString()),
        method: data.paymentMethod || 'cash',
      },
    ];
  }
  return [];
}

function trialBalance(accounts, entries, lines) {
  const posted = new Set(entries.filter((e) => e.status === 'posted').map((e) => e.id));
  const sums = new Map();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const prev = sums.get(line.accountId) || { debit: 0, credit: 0 };
    prev.debit += Number(line.debit || 0);
    prev.credit += Number(line.credit || 0);
    sums.set(line.accountId, prev);
  }
  let totalDebit = 0;
  let totalCredit = 0;
  const byCode = {};
  for (const account of accounts) {
    const sum = sums.get(account.id) || { debit: 0, credit: 0 };
    let debit = round2(sum.debit);
    let credit = round2(sum.credit);
    const opening = round2(Number(account.openingBalance) || 0);
    if (opening !== 0) {
      if (account.normalBalance === 'debit') debit = round2(debit + opening);
      else credit = round2(credit + opening);
    }
    totalDebit = round2(totalDebit + debit);
    totalCredit = round2(totalCredit + credit);
    const normal = account.normalBalance === 'credit' ? 'credit' : 'debit';
    const balance = normal === 'credit' ? round2(credit - debit) : round2(debit - credit);
    byCode[String(account.code)] = { balance, normal, debit, credit, name: account.name };
  }
  return {
    balanced: round2(totalDebit) === round2(totalCredit),
    totalDebit,
    totalCredit,
    byCode,
  };
}

function apBalance(tb) {
  const row = tb.byCode[AP_CODE];
  if (!row) return 0;
  return row.normal === 'credit' ? row.balance : -row.balance;
}

async function loadLedger(db) {
  const [accountsSnap, entriesSnap, linesSnap] = await Promise.all([
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').get(),
    db.collection('stores').doc(STORE_ID).collection('journalEntries').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
  ]);
  return {
    accounts: accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function subledgerApOpen(db) {
  const [purchSnap, paySnap] = await Promise.all([
    db.collection('purchases').where('storeId', '==', STORE_ID).get(),
    db.collection(`stores/${STORE_ID}/financePaymentOrders`).get(),
  ]);
  const payments = paySnap.docs.map((d) => ({
    purchaseOrderId: d.data().purchaseOrderId || d.data().purchase_order_id,
    status: String(d.data().status || '').toLowerCase(),
    amount: round2(Number(d.data().amount) || 0),
  }));
  const paidForPo = (poId, poPaid) => {
    const fromPay = round2(
      payments.filter((p) => p.purchaseOrderId === poId && p.status === 'paid').reduce((s, p) => s + p.amount, 0),
    );
    return round2(Math.max(fromPay, Number(poPaid) || 0));
  };
  let open = 0;
  for (const d of purchSnap.docs) {
    const p = d.data();
    const total = round2(Number(p.total ?? p.totalCost ?? p.totalAmount ?? 0) || 0);
    if (total <= 0) continue;
    const paid = paidForPo(d.id, Number(p.amountPaid ?? 0) || 0);
    const ps = derivePaymentStatus(p, total);
    if (ps === 'paid') continue;
    if (p.status !== 'received' && ps !== 'partial' && ps !== 'unpaid') continue;
    open = round2(open + Math.max(0, total - paid));
  }
  return open;
}

async function main() {
  const db = initAdmin();
  const before = await loadLedger(db);
  const tbBefore = trialBalance(before.accounts, before.entries, before.lines);
  const apBefore = apBalance(tbBefore);
  const cashBefore = tbBefore.byCode[CASH_CODE]?.balance ?? 0;
  const subBefore = await subledgerApOpen(db);

  const accounts = await ensureDefaultChartOfAccounts(STORE_ID);
  const map = accountsMap(accounts);
  const ap = accounts.find((a) => String(a.code) === AP_CODE);
  const cash = accounts.find((a) => String(a.code) === CASH_CODE);
  if (!ap || !cash) throw new Error('Missing 201 or 102 accounts');

  const purchSnap = await db.collection('purchases').where('storeId', '==', STORE_ID).get();
  const toPost = [];
  for (const doc of purchSnap.docs) {
    const data = doc.data();
    const total = round2(Number(data.total ?? data.totalCost ?? data.totalAmount ?? 0) || 0);
    const amountPaid = round2(Number(data.amountPaid ?? 0) || 0);
    const ps = derivePaymentStatus(data, total);
    if (ps !== 'paid' && ps !== 'partial') continue;
    for (const slice of paymentSlices(data, amountPaid)) {
      const event = slice.id === 'aggregate' ? 'paid' : `paid-${slice.id}`;
      const sourceKey = buildSourceKey('purchase_payment', doc.id, event);
      const exists = before.entries.some((e) => e.status === 'posted' && e.sourceKey === sourceKey);
      if (exists) continue;
      toPost.push({
        purchaseId: doc.id,
        invoiceNumber: data.invoiceNumber || '',
        supplierName: data.supplierName || '',
        slice,
        event,
        sourceKey,
      });
    }
  }

  let totalAmount = round2(toPost.reduce((s, r) => s + r.slice.amount, 0));
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'WRITE'}`);
  console.log('BEFORE', {
    tbBalanced: tbBefore.balanced,
    ap201: apBefore,
    cash102: cashBefore,
    subledgerApOpen: subBefore,
    paymentJEsToPost: toPost.length,
    totalPaymentAmount: totalAmount,
  });

  const results = [];
  for (const item of toPost) {
    const input = {
      storeId: STORE_ID,
      date: item.slice.date.slice(0, 10) + 'T12:00:00.000Z',
      memo: `Purchase payment ${item.purchaseId} — ${item.supplierName} (${item.invoiceNumber})`.trim(),
      sourceType: 'purchase_payment',
      sourceId: item.purchaseId,
      event: item.event,
      createdBy: CREATED_BY,
      lines: [
        {
          accountId: ap.id,
          debit: item.slice.amount,
          credit: 0,
          description: 'Accounts payable relief',
        },
        {
          accountId: cash.id,
          debit: 0,
          credit: item.slice.amount,
          description: 'Cash/bank payment',
        },
      ],
    };
    if (dryRun) {
      results.push({ ...item, dryRun: true, amount: item.slice.amount });
      continue;
    }
    const posted = await postJournalEntry(input, map);
    results.push({
      purchaseId: item.purchaseId,
      paymentId: item.slice.id,
      amount: item.slice.amount,
      sourceKey: posted.sourceKey,
      entryId: posted.entryId,
      idempotentReplay: posted.idempotentReplay,
    });
    await new Promise((r) => setTimeout(r, 5));
  }

  if (!dryRun) {
    const after = await loadLedger(db);
    const tbAfter = trialBalance(after.accounts, after.entries, after.lines);
    const apAfter = apBalance(tbAfter);
    const cashAfter = tbAfter.byCode[CASH_CODE]?.balance ?? 0;
    const subAfter = await subledgerApOpen(db);
    console.log('AFTER', {
      tbBalanced: tbAfter.balanced,
      ap201: apAfter,
      cash102: cashAfter,
      subledgerApOpen: subAfter,
      glMinusSubledger: round2(apAfter - subAfter),
      apDelta: round2(apBefore - apAfter),
      cashDelta: round2(cashBefore - cashAfter),
    });
    console.log('SUMMARY', JSON.stringify({ results, totalAmount }, null, 2));
  } else {
    console.log('DRY-RUN would post', toPost.length, 'entries totaling', totalAmount);
    toPost.slice(0, 5).forEach((t) =>
      console.log(' ', t.invoiceNumber, t.slice.id, t.slice.amount, t.sourceKey),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
