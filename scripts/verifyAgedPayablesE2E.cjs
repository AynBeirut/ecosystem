/**
 * Proof AP aging vs GL 201 — platform `purchases` + finance POs (live Firestore).
 */
const admin = require('firebase-admin');
const { readFileSync } = require('fs');
const { join } = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store-id='));
const STORE = storeArg ? storeArg.split('=')[1] : 'Av22LKyet8QmVcu9b8Njz1HVfoy1';
const asOfArg = process.argv.find((a) => a.startsWith('--as-of='));
const AS_OF = asOfArg ? asOfArg.split('=')[1] : new Date().toISOString().slice(0, 10);
const AP = '201';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

try {
  const sa = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
} catch {
  console.error('❌ serviceAccountKey.json required');
  process.exit(1);
}

const db = admin.firestore();

function mapPlatformStatus(platformStatus) {
  const s = String(platformStatus || 'draft').toLowerCase();
  if (s === 'received') return 'fulfilled';
  if (s === 'confirmed' || s === 'ordered') return 'approved';
  if (s === 'sent') return 'sent';
  return 'draft';
}

function derivePaymentStatus(data, total) {
  const raw = String(data.paymentStatus || '').toLowerCase();
  if (raw === 'paid' || raw === 'unpaid' || raw === 'partial') return raw;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? 0) || 0;
  if (total > 0 && amountPaid >= total) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
}

function mapPlatformPurchase(id, data) {
  const total =
    Number(data.total ?? data.totalCost ?? data.totalAmount ?? data.amount ?? 0) || 0;
  const amountPaid = Number(data.amountPaid ?? data.paidAmount ?? 0) || 0;
  return {
    id,
    date: String(data.orderDate ?? data.date ?? data.createdAt ?? ''),
    supplierName: data.supplierName,
    amount: total,
    total,
    paidAmount: amountPaid,
    paymentStatus: derivePaymentStatus(data, total),
    status: mapPlatformStatus(data.status),
    source: 'platform',
  };
}

function mapFinancePo(id, data) {
  const amount = Number(data.amount ?? data.total ?? 0) || 0;
  return {
    id,
    date: String(data.date ?? data.createdAt ?? ''),
    supplierName: data.supplierName ?? data.supplier_name,
    amount,
    total: amount,
    paidAmount: Number(data.paidAmount ?? data.paid_amount ?? 0) || 0,
    status: String(data.status ?? 'draft'),
    source: 'finance',
  };
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
  if (po.status === 'draft') return 0;
  const paid = paidForPo(po.id, payments, po.paidAmount);
  const outstandingFromAmount = round2(Math.max(0, total - paid));
  const paymentStatus = String(po.paymentStatus || '').toLowerCase();
  if (paymentStatus === 'paid') return 0;
  if (paymentStatus === 'unpaid' || paymentStatus === 'partial') return outstandingFromAmount;
  if (po.status === 'sent' || po.status === 'approved') return outstandingFromAmount;
  if (po.status === 'fulfilled') {
    if (po.source === 'platform') return outstandingFromAmount;
    if (paid < total) return outstandingFromAmount;
    return 0;
  }
  return 0;
}

function daysBetween(d1, d2) {
  const ms = new Date(d2).getTime() - new Date(String(d1).slice(0, 10)).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function bucket(days) {
  if (days <= 30) return 'current';
  if (days <= 60) return 'days31_60';
  if (days <= 90) return 'days61_90';
  return 'days91_plus';
}

(async () => {
  console.log('\nAP aging proof — store', STORE, 'as of', AS_OF, '\n');

  const [acctSnap, entrySnap, lineSnap, purchasesSnap, financePoSnap, paySnap] = await Promise.all([
    db.collection(`stores/${STORE}/ledgerAccounts`).get(),
    db.collection(`stores/${STORE}/journalEntries`).get(),
    db.collection(`stores/${STORE}/journalLines`).get(),
    db.collection('purchases').where('storeId', '==', STORE).get(),
    db.collection(`stores/${STORE}/financePurchaseOrders`).get(),
    db.collection(`stores/${STORE}/financePaymentOrders`).get(),
  ]);

  const apAcct = acctSnap.docs.map((d) => ({ id: d.id, ...d.data() })).find((a) => String(a.code) === AP);
  const entries = entrySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lines = lineSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const byId = new Map();
  for (const d of purchasesSnap.docs) {
    byId.set(d.id, mapPlatformPurchase(d.id, d.data()));
  }
  for (const d of financePoSnap.docs) {
    if (!byId.has(d.id)) byId.set(d.id, mapFinancePo(d.id, d.data()));
  }
  const pos = [...byId.values()];
  const payments = paySnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    purchaseOrderId: d.data().purchaseOrderId || d.data().purchase_order_id,
    status: d.data().status,
    amount: d.data().amount,
  }));

  const buckets = { current: 0, days31_60: 0, days61_90: 0, days91_plus: 0 };
  const openRows = [];
  for (const po of pos) {
    const out = outstanding(po, payments);
    if (out <= 0) continue;
    const days = daysBetween(po.date, AS_OF);
    const b = bucket(days);
    buckets[b] = round2(buckets[b] + out);
    openRows.push({
      id: po.id,
      supplier: po.supplierName,
      gross: po.total ?? po.amount,
      paid: paidForPo(po.id, payments, po.paidAmount),
      out,
      days,
      b,
      status: po.status,
      paymentStatus: po.paymentStatus,
      source: po.source,
    });
  }
  const subledgerTotal = round2(Object.values(buckets).reduce((s, n) => s + n, 0));

  let dr = 0;
  let cr = 0;
  for (const line of lines) {
    const entry = entries.find((e) => e.id === line.entryId);
    if (!entry || entry.status !== 'posted') continue;
    if (line.accountId !== apAcct?.id && line.accountCode !== AP) continue;
    if (entry.date.slice(0, 10) > AS_OF) continue;
    dr = round2(dr + (Number(line.debit) || 0));
    cr = round2(cr + (Number(line.credit) || 0));
  }
  const glBalance = round2(cr - dr);

  console.log('Purchase rows (platform + finance):', pos.length);
  console.log('Open POs:', openRows.length);
  console.log('Buckets:', buckets);
  console.log('Subledger total:', subledgerTotal);
  console.log('GL 201 balance:', glBalance);
  console.log('Variance (GL − POs):', round2(glBalance - subledgerTotal));
  openRows.sort((a, b) => b.out - a.out);
  openRows.forEach((r) => console.log(r));
})();
