#!/usr/bin/env node
/**
 * Backfill gross revenue + sales discount (7090/410) on historical POS sale JEs.
 * Cash stays at net; revenue credit grosses up; Dr sales discount contra.
 *
 *   node scripts/backfillLittleHandsSalesDiscount.cjs --dry-run
 *   node scripts/backfillLittleHandsSalesDiscount.cjs --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const STORE_ID = process.env.LITTLE_HANDS_STORE_ID || '8WgfKtgaE8aAXdqFhIfweEo5WFq2';
const DISCOUNT_ACCOUNT_ID = 'acct-410';
const CREATED_BY = 'backfill-littlehands-sales-discount-2026-09-05';
const COUNTED_STATUSES = new Set(['delivered', 'paid', 'completed']);

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function initDb() {
  const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) {
    console.error('❌ serviceAccountKey.json not found');
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))),
      projectId: 'market-flow-7b074',
    });
  }
  return admin.firestore();
}

function resolveSaleAmounts(order) {
  const netTotal = round2(Math.abs(Number(order.total) || 0));
  const taxAmount = round2(Math.max(0, Number(order.taxAmount) || 0));
  const discountAmount = round2(Math.max(0, Number(order.discountAmount ?? order.discount) || 0));
  const subtotal = Number(order.subtotal);
  let grossRevenue = round2(netTotal - taxAmount + discountAmount);
  if (Number.isFinite(subtotal) && subtotal > 0) grossRevenue = round2(subtotal);
  return { netTotal, taxAmount, discountAmount, grossRevenue };
}

function isCountedSale(order) {
  const status = String(order.status || '').toLowerCase();
  const paid = String(order.paymentStatus || '').toLowerCase() === 'paid';
  return COUNTED_STATUSES.has(status) || paid;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = initDb();
  const report = {
    generatedAt: new Date().toISOString(),
    storeId: STORE_ID,
    mode: apply ? 'apply' : 'dry-run',
    fixed: [],
    skipped: [],
    errors: [],
  };

  const [ordersSnap, entriesSnap, linesSnap, discountAcctSnap] = await Promise.all([
    db.collection('orders').where('storeId', '==', STORE_ID).get(),
    db.collection('stores').doc(STORE_ID).collection('journalEntries').where('status', '==', 'posted').get(),
    db.collection('stores').doc(STORE_ID).collection('journalLines').get(),
    db.collection('stores').doc(STORE_ID).collection('ledgerAccounts').doc(DISCOUNT_ACCOUNT_ID).get(),
  ]);

  if (!discountAcctSnap.exists) {
    console.error('❌ Discount account acct-410 missing');
    process.exit(1);
  }
  const discountAcct = discountAcctSnap.data();

  const entryByOrderId = new Map();
  const entryById = new Map();
  entriesSnap.docs.forEach((d) => {
    const e = d.data();
    entryById.set(d.id, { id: d.id, ...e });
    if (e.sourceType === 'order' && e.event === 'sale-recognized' && e.sourceId) {
      entryByOrderId.set(e.sourceId, d.id);
    }
  });

  const linesByEntry = new Map();
  linesSnap.docs.forEach((d) => {
    const l = d.data();
    if (!linesByEntry.has(l.entryId)) linesByEntry.set(l.entryId, []);
    linesByEntry.get(l.entryId).push({ id: d.id, ...l });
  });

  const discountAcctIds = new Set([DISCOUNT_ACCOUNT_ID, 'acct-7090']);
  const writes = [];

  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    if (!isCountedSale(order)) continue;
    const amounts = resolveSaleAmounts(order);
    if (amounts.discountAmount <= 0) continue;

    const entryId = entryByOrderId.get(orderDoc.id);
    if (!entryId) {
      report.errors.push({ orderId: orderDoc.id, invoice: order.invoiceNumber, issue: 'no sale-recognized JE' });
      continue;
    }

    const entry = entryById.get(entryId);
    const lines = linesByEntry.get(entryId) || [];
    const hasDiscountLine = lines.some(
      (l) => discountAcctIds.has(l.accountId) && round2(Number(l.debit) || 0) > 0,
    );
    if (hasDiscountLine) {
      report.skipped.push({ orderId: orderDoc.id, voucher: entry.voucherNumber, reason: 'already has discount line' });
      continue;
    }

    const revenueLines = lines.filter((l) => round2(Number(l.credit) || 0) > 0 && l.accountId !== 'acct-1000');
    const revenueLine = revenueLines.find((l) => !String(l.accountId).includes('tax')) || revenueLines[0];
    if (!revenueLine) {
      report.errors.push({ orderId: orderDoc.id, voucher: entry.voucherNumber, issue: 'no revenue credit line' });
      continue;
    }

    const currentRevenueCredit = round2(Number(revenueLine.credit) || 0);
    const targetRevenueCredit = round2(amounts.grossRevenue);
    const discountDebit = round2(targetRevenueCredit - currentRevenueCredit);

    if (discountDebit <= 0) {
      report.skipped.push({ orderId: orderDoc.id, voucher: entry.voucherNumber, reason: 'non-positive discount delta' });
      continue;
    }

    if (Math.abs(currentRevenueCredit + discountDebit - targetRevenueCredit) > 0.001) {
      report.errors.push({
        orderId: orderDoc.id,
        voucher: entry.voucherNumber,
        issue: 'amount mismatch',
        currentRevenueCredit,
        targetRevenueCredit,
        discountDebit,
        netTotal: amounts.netTotal,
      });
      continue;
    }

    const fix = {
      orderId: orderDoc.id,
      invoice: order.invoiceNumber || orderDoc.id,
      entryId,
      voucher: entry.voucherNumber,
      revenueLineId: revenueLine.id,
      revenueAccountId: revenueLine.accountId,
      fromRevenueCredit: currentRevenueCredit,
      toRevenueCredit: targetRevenueCredit,
      discountDebit,
      grossRevenue: amounts.grossRevenue,
      netTotal: amounts.netTotal,
    };
    report.fixed.push(fix);

    if (!apply) continue;

    const entryRef = db.collection('stores').doc(STORE_ID).collection('journalEntries').doc(entryId);
    const revenueLineRef = db.collection('stores').doc(STORE_ID).collection('journalLines').doc(revenueLine.id);
    const newLineId = `${entryId}-disc`;
    const newLineRef = db.collection('stores').doc(STORE_ID).collection('journalLines').doc(newLineId);

    const voucherMeta = {
      ...(entry.voucherMeta || {}),
      discountAmount: String(discountDebit),
      grossRevenue: String(amounts.grossRevenue),
      netTotal: String(amounts.netTotal),
      salesDiscountBackfill: CREATED_BY,
      salesDiscountBackfillAt: new Date().toISOString(),
    };

    writes.push((batch) => {
      batch.update(revenueLineRef, {
        credit: targetRevenueCredit,
        description: revenueLine.description || 'Sales revenue (gross)',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.set(newLineRef, {
        id: newLineId,
        entryId,
        storeId: STORE_ID,
        accountId: DISCOUNT_ACCOUNT_ID,
        accountCode: discountAcct.code || '410',
        accountName: discountAcct.name || 'Sales Discounts & Returns',
        debit: discountDebit,
        credit: 0,
        description: 'Sales discount',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        backfillSource: CREATED_BY,
      });
      batch.update(entryRef, {
        voucherMeta,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        salesDiscountBackfill: CREATED_BY,
      });
    });
  }

  if (apply && writes.length) {
    const chunk = 100;
    for (let i = 0; i < writes.length; i += chunk) {
      const batch = db.batch();
      for (const fn of writes.slice(i, i + chunk)) fn(batch);
      await batch.commit();
    }
  }

  const outPath = path.join(
    __dirname,
    '..',
    'reporting',
    'data',
    `littlehands-sales-discount-backfill-2026-09-05${apply ? '' : '-dry-run'}.json`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log(`Mode: ${report.mode}`);
  console.log(`Fixed: ${report.fixed.length}`);
  console.log(`Skipped: ${report.skipped.length}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Report: ${outPath}`);

  if (report.errors.length) {
    console.error('❌ Errors present — review report before audit');
    process.exit(1);
  }
  if (!apply && report.fixed.length) {
    console.log('Run with --apply to patch ledger.');
  } else if (apply && report.fixed.length) {
    console.log('✅ Sales discount backfill applied');
  } else {
    console.log('✅ Nothing to backfill');
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
