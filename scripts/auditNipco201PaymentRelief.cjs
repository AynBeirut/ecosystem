#!/usr/bin/env node
/**
 * Nipco — purchase-level audit: paid/partial platform purchases vs purchase_payment GL (Dr 201 / Cr cash).
 * Read-only. No writes.
 *
 *   node scripts/auditNipco201PaymentRelief.cjs
 *   node scripts/auditNipco201PaymentRelief.cjs --json=/tmp/nipco-201-audit.json
 */
const admin = require('firebase-admin');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const STORE = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const AP_CODE = '201';
const CASH_CODES = ['102', '105', '106'];
const jsonArg = process.argv.find((a) => a.startsWith('--json='));
const JSON_OUT = jsonArg ? jsonArg.split('=')[1] : null;
const asOfArg = process.argv.find((a) => a.startsWith('--as-of='));
const AS_OF = asOfArg ? asOfArg.split('=')[1] : new Date().toISOString().slice(0, 10);

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function buildSourceKey(sourceType, sourceId, event) {
  return `${sourceType}:${sourceId}:${event}`;
}

function cashOrBankCode(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'bank' || m === 'card' || m === 'stripe' || m === 'transfer' || m === 'cheque' || m === 'check') {
    return '106';
  }
  if (m.includes('lbp')) return '105';
  return '102';
}

function cashAccountLabel(code) {
  if (code === '106') return '106 Bank USD';
  if (code === '105') return '105 Bank LBP';
  return '102 POS Cash';
}

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function derivePaymentStatus(data, total) {
  const raw = String(data.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'unpaid' || raw === 'partial') return raw;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? data.paid ?? 0) || 0;
  if (total > 0 && amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function purchaseTotal(data) {
  return round2(Number(data.total ?? data.totalCost ?? data.totalAmount ?? data.amount ?? 0) || 0);
}

function normalizePaymentHistory(data, amountPaid) {
  const hist = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
  const rows = hist
    .map((p, idx) => ({
      id: p.id || `hist-${idx}`,
      amount: round2(Number(p.amount) || 0),
      date: String(p.date || p.paymentDate || data.paymentDate || data.paidAt || ''),
      method: p.method || p.paymentMethod || data.paymentMethod || 'cash',
      notes: p.notes || '',
    }))
    .filter((p) => p.amount > 0);
  if (rows.length > 0) return rows;
  if (amountPaid > 0) {
    return [
      {
        id: 'aggregate',
        amount: amountPaid,
        date: String(data.paymentDate || data.paidAt || data.receivedDate || data.orderDate || data.date || ''),
        method: data.paymentMethod || 'cash',
        notes: 'No paymentHistory — using amountPaid on purchase doc',
      },
    ];
  }
  return [];
}

function accountNetDebit(accounts, lines, entries, accountId, asOf) {
  const acct = accounts.find((a) => a.id === accountId);
  if (!acct) return { net: 0, tbDebit: 0 };
  const posted = new Set(
    entries.filter((e) => e.status === 'posted' && String(e.date || '').slice(0, 10) <= asOf).map((e) => e.id),
  );
  let d = 0;
  let c = 0;
  for (const line of lines) {
    if (line.accountId !== accountId && line.accountCode !== acct.code) continue;
    if (!posted.has(line.entryId)) continue;
    d = round2(d + (Number(line.debit) || 0));
    c = round2(c + (Number(line.credit) || 0));
  }
  const opening = round2(Number(acct.openingBalance) || 0);
  if (opening !== 0) {
    if (acct.normalBalance === 'debit') d = round2(d + opening);
    else c = round2(c + opening);
  }
  const net = round2(d - c);
  let tbDebit = 0;
  if (acct.normalBalance === 'debit') {
    tbDebit = net >= 0 ? net : 0;
  } else {
    tbDebit = net < 0 ? -net : 0;
  }
  return { net, tbDebit, debit: d, credit: c };
}

function paidForPo(poId, payments, poPaid) {
  const fromPay = round2(
    payments.filter((p) => p.purchaseOrderId === poId && p.status === 'paid').reduce((s, p) => s + (Number(p.amount) || 0), 0),
  );
  return round2(Math.max(fromPay, Number(poPaid) || 0));
}

function outstanding(po, payments) {
  const total = round2(Number(po.total ?? po.amount) || 0);
  if (total <= 0) return 0;
  const paid = paidForPo(po.id, payments, po.paidAmount);
  const outstandingFromAmount = round2(Math.max(0, total - paid));
  const paymentStatus = String(po.paymentStatus || '').toLowerCase();
  if (paymentStatus === 'paid') return 0;
  if (paymentStatus === 'unpaid' || paymentStatus === 'partial') return outstandingFromAmount;
  if (po.status === 'draft') return 0;
  if (po.status === 'sent' || po.status === 'approved') return outstandingFromAmount;
  if (po.status === 'fulfilled' || po.status === 'received') {
    if (paid < total) return outstandingFromAmount;
    return 0;
  }
  return 0;
}

(async () => {
  console.log('\n=== Nipco 201 payment-relief audit (read-only) ===');
  console.log('Store:', STORE, '| as-of:', AS_OF, '\n');

  const [acctSnap, entrySnap, lineSnap, purchasesSnap, paySnap, financePoSnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
    db.collection('purchases').where('storeId', '==', STORE).get(),
    db.collection(`stores/${STORE}/financePaymentOrders`).get(),
    db.collection(`stores/${STORE}/financePurchaseOrders`).get(),
  ]);

  const accounts = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const apAcct = accounts.find((a) => String(a.code) === AP_CODE);

  const payments = paySnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    purchaseOrderId: d.data().purchaseOrderId || d.data().purchase_order_id,
    status: String(d.data().status || '').toLowerCase(),
    amount: round2(Number(d.data().amount) || 0),
    paymentMethod: d.data().paymentMethod || d.data().payment_method,
    date: d.data().date,
  }));

  const postedEntries = entries.filter((e) => e.status === 'posted' && String(e.date || '').slice(0, 10) <= AS_OF);
  const entryById = new Map(entries.map((e) => [e.id, e]));

  /** Dr 201 on purchase_payment JEs keyed by purchase sourceId */
  const apDebitByPurchaseId = new Map();
  /** All purchase_payment posted entries by purchase id */
  const paymentEntriesByPurchaseId = new Map();

  for (const e of postedEntries) {
    if (String(e.sourceType || '') !== 'purchase_payment') continue;
    const pid = String(e.sourceId || '');
    if (!pid) continue;
    if (!paymentEntriesByPurchaseId.has(pid)) paymentEntriesByPurchaseId.set(pid, []);
    paymentEntriesByPurchaseId.get(pid).push(e);

    let dr201 = 0;
    for (const line of lines) {
      if (line.entryId !== e.id) continue;
      if (line.accountId === apAcct?.id || line.accountCode === AP_CODE) {
        dr201 = round2(dr201 + (Number(line.debit) || 0));
      }
    }
    if (dr201 > 0) {
      apDebitByPurchaseId.set(pid, round2((apDebitByPurchaseId.get(pid) || 0) + dr201));
    }
  }

  /** Finance payment orders marked paid — expected source keys */
  const financePaidByPurchase = new Map();
  for (const p of payments) {
    if (p.status !== 'paid' || !p.purchaseOrderId) continue;
    if (!financePaidByPurchase.has(p.purchaseOrderId)) financePaidByPurchase.set(p.purchaseOrderId, []);
    financePaidByPurchase.get(p.purchaseOrderId).push(p);
  }

  function hasJeForFinancePayment(payment) {
    const pid = payment.purchaseOrderId;
    const keys = [
      buildSourceKey('purchase_payment', pid, `paid-${payment.id}`),
      buildSourceKey('purchase_payment', pid, 'paid'),
    ];
    for (const k of keys) {
      if (postedEntries.some((e) => e.sourceKey === k)) return true;
    }
    const list = paymentEntriesByPurchaseId.get(pid) || [];
    return list.some((e) => String(e.event || '') === `paid-${payment.id}` || e.sourceKey === keys[0]);
  }

  const gapRows = [];
  let totalMissingRelief = 0;
  let purchaseCountPaidPartial = 0;

  for (const doc of purchasesSnap.docs) {
    const data = doc.data();
    const total = purchaseTotal(data);
    const amountPaid = round2(Number(data.amountPaid ?? data.paidAmount ?? data.paid ?? 0) || 0);
    const paymentStatus = derivePaymentStatus(data, total);
    if (paymentStatus !== 'paid' && paymentStatus !== 'partial') continue;
    purchaseCountPaidPartial++;

    const glApDebit = apDebitByPurchaseId.get(doc.id) || 0;
    const paidSubledger = amountPaid;
    const missingOnPurchase = round2(Math.max(0, paidSubledger - glApDebit));

    const paymentSlices = normalizePaymentHistory(data, amountPaid);
    const sliceRows = [];

    for (const slice of paymentSlices) {
      const expectedCash = cashOrBankCode(slice.method);
      let jeFound = false;
      let jeDetail = '';

      if (slice.id !== 'aggregate') {
        const sk = buildSourceKey('purchase_payment', doc.id, `paid-${slice.id}`);
        const skPaid = buildSourceKey('purchase_payment', doc.id, 'paid');
        jeFound = postedEntries.some((e) => e.sourceKey === sk || e.sourceKey === skPaid);
        jeDetail = jeFound ? `sourceKey match` : `missing ${sk}`;
      } else {
        jeFound = glApDebit >= round2(slice.amount - 0.02);
        jeDetail = jeFound
          ? `aggregate Dr201 on purchase_payment = ${glApDebit}`
          : `no purchase_payment Dr201 (got ${glApDebit}, need ${slice.amount})`;
      }

      const financeForPo = financePaidByPurchase.get(doc.id) || [];
      const financePosted = financeForPo.filter((fp) => hasJeForFinancePayment(fp));

      sliceRows.push({
        paymentId: slice.id,
        amount: slice.amount,
        datePaid: slice.date ? slice.date.slice(0, 10) : '',
        paymentMethod: slice.method,
        expectedCashAccount: cashAccountLabel(expectedCash),
        jeFoundForSlice: jeFound,
        jeDetail,
        financePaymentOrdersPaid: financeForPo.length,
        financePaymentOrdersWithJe: financePosted.length,
      });
    }

    if (missingOnPurchase > 0.01) {
      totalMissingRelief = round2(totalMissingRelief + missingOnPurchase);
      gapRows.push({
        purchaseId: doc.id,
        supplier: data.supplierName || data.supplier || 'Unknown',
        invoiceNumber: data.invoiceNumber || data.purchaseNumber || '',
        purchaseStatus: data.status || '',
        paymentStatus,
        purchaseTotal: total,
        amountPaidSubledger: paidSubledger,
        glApDebitPosted: glApDebit,
        missingApRelief: missingOnPurchase,
        payments: sliceRows,
      });
    }
  }

  gapRows.sort((a, b) => b.missingApRelief - a.missingApRelief);

  // GL 201 vs subledger (platform purchases + finance POs, same as aged payables script)
  const byId = new Map();
  for (const d of purchasesSnap.docs) {
    const data = d.data();
    const total = purchaseTotal(data);
    byId.set(d.id, {
      id: d.id,
      date: String(data.orderDate ?? data.date ?? data.createdAt ?? ''),
      supplierName: data.supplierName,
      total,
      paidAmount: round2(Number(data.amountPaid ?? data.paidAmount ?? 0) || 0),
      paymentStatus: derivePaymentStatus(data, total),
      status: data.status === 'received' ? 'fulfilled' : data.status,
      source: 'platform',
    });
  }
  for (const d of financePoSnap.docs) {
    if (byId.has(d.id)) continue;
    const data = d.data();
    byId.set(d.id, {
      id: d.id,
      total: round2(Number(data.amount ?? data.total ?? 0) || 0),
      paidAmount: round2(Number(data.paidAmount ?? data.paid_amount ?? 0) || 0),
      status: String(data.status ?? 'draft'),
      paymentStatus: '',
      source: 'finance',
    });
  }
  let subledgerOpen = 0;
  for (const po of byId.values()) {
    subledgerOpen = round2(subledgerOpen + outstanding(po, payments));
  }

  let apDr = 0;
  let apCr = 0;
  for (const line of lines) {
    const entry = entryById.get(line.entryId);
    if (!entry || entry.status !== 'posted') continue;
    if (String(entry.date || '').slice(0, 10) > AS_OF) continue;
    if (line.accountId !== apAcct?.id && line.accountCode !== AP_CODE) continue;
    apDr = round2(apDr + (Number(line.debit) || 0));
    apCr = round2(apCr + (Number(line.credit) || 0));
  }
  const gl201Balance = round2(apCr - apDr);
  const glMinusSubledger = round2(gl201Balance - subledgerOpen);

  const cashAccounts = accounts.filter((a) => CASH_CODES.includes(String(a.code)));
  const cashDetail = {};
  let totalCashNet = 0;
  for (const acct of cashAccounts) {
    const s = accountNetDebit(accounts, lines, entries, acct.id, AS_OF);
    cashDetail[acct.code] = { name: acct.name, netDebitBalance: s.net, tbDebit: s.tbDebit };
    totalCashNet = round2(totalCashNet + s.net);
  }
  const cashAfterRelief = round2(totalCashNet - totalMissingRelief);

  const report = {
    generatedAt: new Date().toISOString(),
    storeId: STORE,
    asOf: AS_OF,
    purchasePaidOrPartialCount: purchaseCountPaidPartial,
    purchasesWithMissingApReliefCount: gapRows.length,
    totalMissingApRelief: totalMissingRelief,
    gl201Balance,
    apSubledgerOpen: subledgerOpen,
    varianceGl201MinusSubledger: glMinusSubledger,
    expectedVarianceReference: 161752.77,
    cashBeforeSimulatedRelief: { totalNetDebit: totalCashNet, byAccount: cashDetail },
    cashAfterSimulatedRelief: cashAfterRelief,
    gapRows,
  };

  console.log('Paid/partial platform purchases:', purchaseCountPaidPartial);
  console.log('Purchases with missing Dr201 relief (paid − posted):', gapRows.length);
  console.log('TOTAL missing AP relief (sum):', totalMissingRelief);
  console.log('GL 201 balance (Cr−Dr):', gl201Balance);
  console.log('AP subledger open:', subledgerOpen);
  console.log('Variance GL201 − subledger:', glMinusSubledger, '(ref ~161752.77)');
  console.log('\nCash (102+105+106) net debit balance now:', totalCashNet);
  console.log('After posting missing relief (Cr cash):', cashAfterRelief);
  for (const [code, v] of Object.entries(cashDetail)) {
    console.log(`  ${code} ${v.name}: net ${v.netDebitBalance}`);
  }

  console.log('\n--- Line items (missing relief) ---');
  for (const row of gapRows) {
    console.log(
      [
        row.purchaseId.slice(0, 8),
        row.supplier.slice(0, 28),
        `paid ${row.amountPaidSubledger}`,
        `glDr201 ${row.glApDebitPosted}`,
        `MISS ${row.missingApRelief}`,
        row.paymentStatus,
      ].join(' | '),
    );
    for (const p of row.payments) {
      console.log(
        `    ${p.datePaid || '?'} ${p.amount} → ${p.expectedCashAccount} | ${p.jeDetail}`,
      );
    }
  }

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log('\nWrote', JSON_OUT);
  }

  console.log('\nDone (no writes).\n');
})();
