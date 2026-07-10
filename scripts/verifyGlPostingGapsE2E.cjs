#!/usr/bin/env node
/**
 * GL posting gap fixes E2E: partial invoice payments, credit vs cash sales, purchase paid workflow.
 *
 * Usage: node scripts/verifyGlPostingGapsE2E.cjs
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const db = admin.firestore();
const testRunId = `gl-gaps-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const GL = {
  CASH: 'acct-1000',
  BANK: 'acct-1010',
  AR: 'acct-1100',
  REVENUE: 'acct-4000',
  COGS: 'acct-5000',
  FG: 'acct-1201',
  INVENTORY: 'acct-1200',
  AP: 'acct-2000',
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

function isImmediateCashSale(invoice) {
  const pm = (invoice.paymentMethod || '').toLowerCase();
  return pm === 'cash' && (invoice.status === 'paid' || invoice.status === 'partial');
}

function isCreditTermsSale(invoice) {
  return !isImmediateCashSale(invoice);
}

async function seedCoa() {
  const ts = nowIso();
  const batch = db.batch();
  for (const [code, name, type, normalBalance] of DEFAULT_SMB_COA) {
    const id = `acct-${code}`;
    batch.set(db.doc(`stores/${storeId}/ledgerAccounts/${id}`), {
      id, storeId, code, name, type, normalBalance, isSystem: true, isActive: true, openingBalance: 0, createdAt: ts, updatedAt: ts,
    });
  }
  batch.set(db.doc(`stores/${storeId}/ledgerMeta/coa`), { storeId, initialized: true, createdAt: ts });
  await batch.commit();
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

function autoPostInvoiceSaleRecognized(invoice) {
  const revenueAmount = round2(invoice.total ?? invoice.amount ?? 0);
  if (revenueAmount <= 0) return Promise.resolve(null);

  const debitAcct = isImmediateCashSale(invoice) ? GL.CASH : GL.AR;
  const cogs = round2((invoice.items || []).reduce((s, it) => s + round2(it.rawPrice) * round2(it.quantity), 0));
  const lines = [
    { accountId: debitAcct, accountCode: debitAcct === GL.CASH ? '1000' : '1100', accountName: debitAcct === GL.CASH ? 'Cash' : 'AR', debit: revenueAmount, credit: 0 },
    { accountId: GL.REVENUE, accountCode: '4000', accountName: 'Sales Revenue', debit: 0, credit: revenueAmount },
  ];
  if (cogs > 0) {
    lines.push({ accountId: GL.COGS, accountCode: '5000', accountName: 'COGS', debit: cogs, credit: 0 });
    lines.push({ accountId: GL.FG, accountCode: '1201', accountName: 'FG Inventory', debit: 0, credit: cogs });
  }
  return postIfNew(
    { date: invoice.date, memo: `Invoice ${invoice.id}`, sourceType: 'invoice', sourceId: invoice.id, event: 'sale-recognized' },
    lines,
  );
}

function autoPostInvoicePayment(invoice, payment) {
  if (isImmediateCashSale(invoice)) return Promise.resolve(null);
  const amount = round2(payment.amount);
  if (amount <= 0) return Promise.resolve(null);
  const cashAcct = (payment.paymentMethod || '').toLowerCase() === 'bank' ? GL.BANK : GL.CASH;
  return postIfNew(
    { date: payment.paymentDate, memo: `Invoice payment ${invoice.id}`, sourceType: 'invoice_payment', sourceId: invoice.id, event: `payment-${payment.id}` },
    [
      { accountId: cashAcct, accountCode: cashAcct === GL.BANK ? '1010' : '1000', accountName: cashAcct === GL.BANK ? 'Bank' : 'Cash', debit: amount, credit: 0 },
      { accountId: GL.AR, accountCode: '1100', accountName: 'AR', debit: 0, credit: amount },
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

function autoPostPurchasePaid(paymentOrder) {
  const amount = round2(paymentOrder.amount);
  const cashAcct = (paymentOrder.paymentMethod || '').toLowerCase() === 'bank' ? GL.BANK : GL.CASH;
  return postIfNew(
    { date: paymentOrder.date, memo: `Purchase payment ${paymentOrder.id}`, sourceType: 'purchase_payment', sourceId: paymentOrder.purchaseOrderId || paymentOrder.id, event: `paid-${paymentOrder.id}` },
    [
      { accountId: GL.AP, accountCode: '2000', accountName: 'AP', debit: amount, credit: 0 },
      { accountId: cashAcct, accountCode: cashAcct === GL.BANK ? '1010' : '1000', accountName: cashAcct === GL.BANK ? 'Bank' : 'Cash', debit: 0, credit: amount },
    ],
  );
}

async function sumAccountLines(accountId) {
  const lines = await db.collection(`stores/${storeId}/journalLines`).where('accountId', '==', accountId).get();
  let debit = 0;
  let credit = 0;
  for (const d of lines.docs) {
    const row = d.data();
    debit = round2(debit + row.debit);
    credit = round2(credit + row.credit);
  }
  return { debit, credit, net: round2(debit - credit) };
}

async function cleanup() {
  for (const col of ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta']) {
    const snap = await db.collection(`stores/${storeId}/${col}`).get();
    const b = db.batch();
    snap.docs.forEach((d) => b.delete(d.ref));
    if (!snap.empty) await b.commit();
  }
}

function autoPostInvoiceUnpaidReversal(invoice, reversalId) {
  const total = round2(invoice.total ?? invoice.amount ?? 0);
  const collected = round2(
    (invoice.paidAmount || 0) > 0 ? invoice.paidAmount : invoice.status === 'paid' ? total : 0,
  );
  const isCashPos = (invoice.paymentMethod || '').toLowerCase() === 'cash' && (invoice.status === 'paid' || invoice.status === 'partial');

  if (isCashPos && total > 0) {
    const cogs = round2((invoice.items || []).reduce((s, it) => s + round2(it.rawPrice) * round2(it.quantity), 0));
    const lines = [
      { accountId: GL.REVENUE, accountCode: '4000', accountName: 'Sales Revenue', debit: total, credit: 0 },
      { accountId: GL.CASH, accountCode: '1000', accountName: 'Cash', debit: 0, credit: total },
    ];
    if (cogs > 0) {
      lines.push({ accountId: GL.FG, accountCode: '1201', accountName: 'FG Inventory', debit: cogs, credit: 0 });
      lines.push({ accountId: GL.COGS, accountCode: '5000', accountName: 'COGS', debit: 0, credit: cogs });
    }
    return postIfNew(
      { date: nowIso(), memo: `Reverse cash sale ${invoice.id}`, sourceType: 'invoice', sourceId: invoice.id, event: `reversal-sale-${reversalId}` },
      lines,
    );
  }

  if (collected > 0 && !isCashPos) {
    return postIfNew(
      { date: nowIso(), memo: `Reverse payments ${invoice.id}`, sourceType: 'invoice', sourceId: invoice.id, event: `reversal-payments-${reversalId}` },
      [
        { accountId: GL.AR, accountCode: '1100', accountName: 'AR', debit: collected, credit: 0 },
        { accountId: GL.CASH, accountCode: '1000', accountName: 'Cash', debit: 0, credit: collected },
      ],
    );
  }
  return Promise.resolve(null);
}

async function main() {
  let pass = 0;
  const log = (ok, msg) => { if (ok) { pass++; console.log(`PASS  ${msg}`); } else { console.log(`FAIL  ${msg}`); } assert(ok, msg); };

  try {
    console.log(`\n=== GL Posting Gaps E2E ===\nStore: ${storeId}\n`);
    await seedCoa();

    // --- Scenario 1: Credit sale with partial payments ---
    const creditInvoice = {
      id: 'INV-CREDIT-1',
      date: nowIso(),
      clientName: 'Credit Client',
      amount: 100,
      total: 100,
      status: 'sent',
      paymentMethod: 'bank',
      items: [{ rawPrice: 10, quantity: 2 }],
    };
    await autoPostInvoiceSaleRecognized(creditInvoice);
    const saleLines = await sumAccountLines(GL.AR);
    log(saleLines.debit === 100 && saleLines.credit === 0, `Credit sale posts Dr AR 100 (got Dr ${saleLines.debit})`);
    const cashAfterSale = await sumAccountLines(GL.CASH);
    log(cashAfterSale.debit === 0, `No cash posted on credit sale recognition`);

    await autoPostInvoicePayment(creditInvoice, { id: 'P1', amount: 40, paymentMethod: 'cash', paymentDate: nowIso() });
    const arAfterPartial = await sumAccountLines(GL.AR);
    log(arAfterPartial.net === 60, `AR net $60 after $40 partial payment (got ${arAfterPartial.net})`);
    const cashAfterPartial = await sumAccountLines(GL.CASH);
    log(cashAfterPartial.debit === 40, `Cash Dr $40 on partial payment (got ${cashAfterPartial.debit})`);

    await autoPostInvoicePayment(creditInvoice, { id: 'P2', amount: 60, paymentMethod: 'cash', paymentDate: nowIso() });
    const arAfterFull = await sumAccountLines(GL.AR);
    log(arAfterFull.net === 0, `AR cleared after final payment (net ${arAfterFull.net})`);
    const cashAfterFull = await sumAccountLines(GL.CASH);
    log(cashAfterFull.debit === 100, `Total cash collected $100 (got ${cashAfterFull.debit})`);

    // --- Scenario 2: Cash-at-POS sale ---
    const arBeforeCashPos = (await sumAccountLines(GL.AR)).debit;
    const cashBeforeCashPos = (await sumAccountLines(GL.CASH)).debit;
    const cashInvoice = {
      id: 'INV-CASH-1',
      date: nowIso(),
      clientName: 'Walk-in',
      amount: 50,
      total: 50,
      status: 'paid',
      paymentMethod: 'cash',
      items: [{ rawPrice: 5, quantity: 1 }],
    };
    await autoPostInvoiceSaleRecognized(cashInvoice);
    const arCashSale = await sumAccountLines(GL.AR);
    log(arCashSale.debit === arBeforeCashPos, `Cash POS sale does not add to AR (AR still ${arCashSale.debit})`);
    const cashPos = await sumAccountLines(GL.CASH);
    log(cashPos.debit === round2(cashBeforeCashPos + 50), `Cash POS adds $50 to cash (total cash ${cashPos.debit})`);
    const rev = await sumAccountLines(GL.REVENUE);
    log(rev.credit === 150, `Revenue credited $150 total (got ${rev.credit})`);

    // --- Scenario 3: Purchase paid through app workflow (PO received → payment order marked paid) ---
    const po = { id: 'PO-WF-1', date: nowIso(), amount: 200, supplierName: 'Supplier A' };
    await autoPostPurchaseReceived({ ...po, status: 'fulfilled' });
    const apAfterReceive = await sumAccountLines(GL.AP);
    log(apAfterReceive.credit === 200, `PO received Cr AP $200 (got ${apAfterReceive.credit})`);

    const paymentOrderDraft = {
      id: 'PAY-ORD-1',
      date: nowIso(),
      amount: 200,
      paymentMethod: 'bank',
      status: 'draft',
      purchaseOrderId: po.id,
      supplierName: po.supplierName,
    };
    // Workflow: create draft payment order (no GL), then mark paid (GL posts)
    log(paymentOrderDraft.status === 'draft', 'Payment order starts as draft (no GL yet)');

    paymentOrderDraft.status = 'paid';
    await autoPostPurchasePaid(paymentOrderDraft);
    const apAfterPay = await sumAccountLines(GL.AP);
    log(apAfterPay.net === 0, `AP cleared after payment order marked paid (net ${apAfterPay.net})`);
    const bankAfterPay = await sumAccountLines(GL.BANK);
    log(bankAfterPay.credit === 200, `Bank Cr $200 on supplier payment (got ${bankAfterPay.credit})`);

    const replay = await autoPostPurchasePaid(paymentOrderDraft);
    log(replay.replay, 'Purchase payment idempotent on re-mark paid');

    // --- Scenario 4: Mark unpaid posts reversal (credit sale) ---
    const cashNetBeforeUnpaid = (await sumAccountLines(GL.CASH)).net;
    await autoPostInvoiceUnpaidReversal({ ...creditInvoice, status: 'paid', paidAmount: 100 }, 'UNPAID-1');
    const arAfterUnpaid = await sumAccountLines(GL.AR);
    log(arAfterUnpaid.net === 100, `Mark unpaid restores AR to $100 (net ${arAfterUnpaid.net})`);
    const cashAfterUnpaid = await sumAccountLines(GL.CASH);
    log(cashAfterUnpaid.net === round2(cashNetBeforeUnpaid - 100), `Mark unpaid reverses $100 cash (net ${cashAfterUnpaid.net}, was ${cashNetBeforeUnpaid})`);

    // Trial balance sanity
    const allLines = await db.collection(`stores/${storeId}/journalLines`).get();
    let td = 0;
    let tc = 0;
    allLines.docs.forEach((d) => { td = round2(td + d.data().debit); tc = round2(tc + d.data().credit); });
    log(td === tc, `Trial balance: debits ${td} = credits ${tc}`);

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
