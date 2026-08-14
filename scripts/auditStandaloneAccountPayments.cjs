#!/usr/bin/env node
/**
 * Review standalone accountPayments before GL backfill (Phase C pre-check).
 * Usage: node scripts/auditStandaloneAccountPayments.cjs --storeId=...
 */
const { readFileSync } = require('fs');
const { join } = require('path');
const admin = require(join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const {
  findExactPartyAmountDateDuplicate,
  findSupersedingOrderReceipt,
  buildOrderReceiptIndexes,
  shouldHideLegacyAccountPayment,
  round2,
} = require('./lib/accountPaymentDedupe.cjs');

try {
  const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
} catch (error) {
  console.error('Failed to init Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const storeArg = process.argv.find((a) => a.startsWith('--storeId='));
const onlyStoreId = storeArg ? storeArg.split('=')[1] : null;

if (!onlyStoreId) {
  console.error('Required: --storeId=...');
  process.exit(1);
}

async function main() {
  const [apSnap, recSnap, ordersSnap] = await Promise.all([
    db.collection('accountPayments').where('storeId', '==', onlyStoreId).get(),
    db.collection('stores').doc(onlyStoreId).collection('financeReceipts').get(),
    db.collection('orders').where('storeId', '==', onlyStoreId).get(),
  ]);

  const receipts = recSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accountPayments = apSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ordersById = new Map(ordersSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const indexes = buildOrderReceiptIndexes(receipts);

  const standalone = [];
  const allocationHidden = [];
  const supplierOut = [];

  for (const payment of accountPayments) {
    const exact = findExactPartyAmountDateDuplicate(payment, indexes);

    if (payment.direction === 'out' && payment.accountType === 'supplier') {
      supplierOut.push(payment);
      continue;
    }

    if (payment.direction !== 'in' || payment.accountType !== 'customer') continue;
    if (exact && exact.reason === 'exact_party_amount_date') continue;

    if (shouldHideLegacyAccountPayment(payment, indexes)) {
      const match = findSupersedingOrderReceipt(payment, indexes);
      allocationHidden.push({
        id: payment.id,
        party: payment.accountName,
        amount: round2(payment.amount),
        date: String(payment.date || '').slice(0, 10),
        hideReason: match?.reason,
        invoiceNumber: match?.invoiceNumber,
      });
      continue;
    }

    const alloc = payment.orderAllocation?.appliedOrderIds || [];
    const allocOrders = alloc.map((id) => ordersById.get(String(id))).filter(Boolean);
    const allocReceipts = alloc
      .map((id) => indexes.byOrderId.get(String(id)))
      .filter(Boolean);

    standalone.push({
      id: payment.id,
      party: payment.accountName,
      amount: round2(payment.amount),
      date: String(payment.date || '').slice(0, 10),
      method: payment.method,
      allocatedOrderCount: alloc.length,
      allocatedOrders: allocOrders.slice(0, 3).map((o) => ({
        id: o.id,
        invoiceNumber: o.invoiceNumber,
        customerName: o.customerName,
        total: round2(o.total),
        amountPaid: round2(o.amountPaid),
      })),
      allocatedReceiptCount: allocReceipts.length,
      notes: payment.notes || '',
    });
  }

  console.log(JSON.stringify({
    storeId: onlyStoreId,
    exactDuplicateCount: accountPayments.filter((p) => {
      const m = findExactPartyAmountDateDuplicate(p, indexes);
      return m && m.reason === 'exact_party_amount_date';
    }).length,
    allocationHiddenCount: allocationHidden.length,
    standaloneCustomerInCount: standalone.length,
    supplierOutCount: supplierOut.length,
    glBackfillEligibleEstimate: supplierOut.length,
    glBackfillCustomerRvRecommendation: 'skip — all hidden by allocation/order receipt overlap',
    allocationHidden,
    standaloneCustomerIn: standalone,
    supplierOut: supplierOut.map((p) => ({
      id: p.id,
      party: p.accountName,
      amount: round2(p.amount),
      date: String(p.date || '').slice(0, 10),
      method: p.method,
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
