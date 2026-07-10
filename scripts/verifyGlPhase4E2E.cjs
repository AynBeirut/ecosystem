#!/usr/bin/env node
/**
 * GL Phase 4 E2E — platform bridge: manufacture → sale → return → subledger reconcile.
 *
 * Usage:
 *   node scripts/verifyGlPhase4E2E.cjs
 *   node scripts/verifyGlPhase4E2E.cjs --keep
 */
const admin = require('firebase-admin');
const path = require('path');

const KEEP = process.argv.includes('--keep');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const functionsAdmin = require('../functions/node_modules/firebase-admin');
if (!functionsAdmin.apps.length) {
  functionsAdmin.initializeApp({
    credential: functionsAdmin.credential.cert(serviceAccount),
    projectId: 'market-flow-7b074',
  });
}

const db = admin.firestore();
const testRunId = `gl-phase4-e2e-${Date.now()}`;
const storeId = `test-${testRunId}`;

const {
  ensureDefaultChartOfAccounts,
  postJournalEntry,
  accountsMap,
  accountByCode,
  buildSourceKey,
} = require('../functions/lib/lib/ledger/postingService');
const {
  autoPostOrderSaleRecognized,
  autoPostOrderSaleReversal,
  autoPostProductionComplete,
  autoPostPayrollPayment,
  autoPostCashCollectionDeposit,
} = require('../functions/lib/lib/ledger/platformAutoPosting');
const { GL_ACCOUNT_CODES } = require('../functions/lib/lib/ledger/defaultChartOfAccounts');

function nowIso() { return new Date().toISOString(); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function assert(c, m) { if (!c) throw new Error(m); }

async function sumAccountBalance(code) {
  const acctId = `acct-${code}`;
  const lines = await db.collection('stores').doc(storeId).collection('journalLines')
    .where('accountCode', '==', code).get();
  let net = 0;
  lines.forEach((d) => {
    const row = d.data();
    net += round2(row.debit || 0) - round2(row.credit || 0);
  });
  return round2(net);
}

async function cleanup() {
  const collections = ['ledgerAccounts', 'journalEntries', 'journalLines', 'ledgerMeta'];
  for (const col of collections) {
    const snap = await db.collection('stores').doc(storeId).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
  for (const col of ['finishedGoodsInventory', 'orders', 'productionBatches', 'salaryPayments', 'cashCollections']) {
    const snap = await db.collection(col).where('storeId', '==', storeId).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  }
}

async function main() {
  console.log(`\n=== GL Phase 4 E2E — ${storeId} ===\n`);

  const accounts = await ensureDefaultChartOfAccounts(storeId);
  const map = accountsMap(accounts);

  const productId = `prod-${testRunId}`;
  const fgId = `fg-${testRunId}`;
  const batchId = `batch-${testRunId}`;
  const orderId = `order-${testRunId}`;

  const materialsCost = 40;
  const qtyManufactured = 10;
  const fgUnitCost = round2(materialsCost / qtyManufactured);
  const saleQty = 3;
  const saleTotal = 75;
  const saleCogs = round2(fgUnitCost * saleQty);

  await db.collection('finishedGoodsInventory').doc(fgId).set({
    storeId,
    productId,
    composedProductId: productId,
    currentBalance: qtyManufactured,
    quantityManufactured: qtyManufactured,
    quantitySold: 0,
    costPrice: fgUnitCost,
    totalValue: round2(qtyManufactured * fgUnitCost),
    valuationMethod: 'WEIGHTED_AVERAGE',
    transactions: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await db.collection('productionBatches').doc(batchId).set({
    storeId,
    status: 'completed',
    materialsCost,
    actualQuantity: qtyManufactured,
    productId,
    createdAt: nowIso(),
  });

  const prodResult = await autoPostProductionComplete(storeId, batchId, materialsCost, nowIso(), accounts);
  assert(prodResult && !prodResult.idempotentReplay, 'Production GL should post once');
  console.log('✓ Production complete → Dr FG / Cr Raw Materials');

  const fgAfterProd = round2(await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY));
  assert(fgAfterProd === materialsCost, `FG GL ${fgAfterProd} should equal materials ${materialsCost}`);

  await db.collection('orders').doc(orderId).set({
    storeId,
    invoiceNumber: `INV-${testRunId}`,
    total: saleTotal,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    items: [{ productId, quantity: saleQty, price: 25 }],
    createdAt: nowIso(),
  });

  const orderInput = {
    id: orderId,
    storeId,
    date: nowIso(),
    total: saleTotal,
    paymentMethod: 'cash',
    invoiceNumber: `INV-${testRunId}`,
    cogsLines: [{ productKey: productId, quantity: saleQty, unitCost: fgUnitCost }],
    isCashSale: true,
  };

  const saleResult = await autoPostOrderSaleRecognized(storeId, orderInput, accounts);
  assert(saleResult && !saleResult.idempotentReplay, 'Order sale GL should post');
  console.log('✓ Order sale → Dr Cash / Cr Revenue + Dr COGS / Cr FG');

  const cogsGl = round2(await sumAccountBalance(GL_ACCOUNT_CODES.COGS));
  assert(cogsGl === saleCogs, `COGS GL ${cogsGl} should match subledger ${saleCogs}`);

  const fgAfterSale = round2(await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY));
  assert(fgAfterSale === round2(materialsCost - saleCogs), `FG after sale ${fgAfterSale}`);

  const returnId = `ret-${testRunId}`;
  const returnCogsLines = [{ productKey: productId, quantity: 1, unitCost: fgUnitCost }];
  const revResult = await autoPostOrderSaleReversal(
    storeId,
    { ...orderInput, total: 25, cogsLines: returnCogsLines },
    accounts,
    returnId,
  );
  assert(revResult && !revResult.idempotentReplay, 'Return reversal GL should post');
  console.log('✓ Return → revenue/COGS reversal');

  const payrollId = `pay-${testRunId}`;
  await autoPostPayrollPayment(storeId, payrollId, 500, nowIso(), 'bank', accounts);
  console.log('✓ Payroll → Dr Payroll / Cr Bank');

  const collectionId = `cc-${testRunId}`;
  await autoPostCashCollectionDeposit(storeId, collectionId, 100, nowIso(), accounts);
  console.log('✓ Bank deposit → Dr Bank / Cr Cash');

  const entries = await db.collection('stores').doc(storeId).collection('journalEntries').get();
  assert(entries.size >= 5, `Expected >=5 journal entries, got ${entries.size}`);

  let debits = 0;
  let credits = 0;
  const lineSnap = await db.collection('stores').doc(storeId).collection('journalLines').get();
  lineSnap.forEach((d) => {
    debits += round2(d.data().debit || 0);
    credits += round2(d.data().credit || 0);
  });
  assert(debits === credits, `Trial balance out of sync: D=${debits} C=${credits}`);

  const fgSubledgerValue = round2((qtyManufactured - saleQty + 1) * fgUnitCost);
  const fgGlNet = round2(await sumAccountBalance(GL_ACCOUNT_CODES.FG_INVENTORY));
  console.log(`  FG subledger (after return +1 unit): $${fgSubledgerValue}`);
  console.log(`  FG GL net: $${fgGlNet}`);

  const replay = await autoPostOrderSaleRecognized(storeId, orderInput, accounts);
  assert(replay && replay.idempotentReplay, 'Idempotent replay expected on duplicate order sale');

  console.log('\n=== GL Phase 4 E2E PASSED ===\n');
  if (!KEEP) await cleanup();
}

main().catch(async (err) => {
  console.error('\n=== GL Phase 4 E2E FAILED ===');
  console.error(err);
  if (!KEEP) {
    try { await cleanup(); } catch (_) { /* ignore */ }
  }
  process.exit(1);
});
