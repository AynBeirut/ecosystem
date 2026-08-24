#!/usr/bin/env node
/**
 * Import Jinan's Kitchen handwritten daily ledger (sales → orders, achat → financeExpenses).
 *
 * Source: reporting/data/jinan-daily-ledger-2026-08-01-02.json
 *
 *   node scripts/importJinanDailyLedger.cjs           # dry-run (Aug 1–2 default)
 *   node scripts/importJinanDailyLedger.cjs --write   # apply
 *   node scripts/importJinanDailyLedger.cjs --file reporting/data/jinan-daily-ledger-2026-08-03.json --write
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DEFAULT_LEDGER_PATH = path.join(
  process.cwd(),
  'reporting/data/jinan-daily-ledger-2026-08-01-02.json',
);
const write = process.argv.includes('--write');
const fileArgIndex = process.argv.indexOf('--file');
const LEDGER_PATH =
  fileArgIndex >= 0 && process.argv[fileArgIndex + 1]
    ? path.resolve(process.cwd(), process.argv[fileArgIndex + 1])
    : DEFAULT_LEDGER_PATH;

function nowIso() {
  return new Date().toISOString();
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function dateAtNoonUtc(dateStr) {
  return new Date(`${dateStr}T12:00:00.000Z`).toISOString();
}

function matchProduct(label, products) {
  const lower = label.toLowerCase();
  const rules = [
    { test: /pizza/, skuMatch: (p) => /pizza/i.test(p.name) && !/sauce/i.test(p.name) },
    { test: /foul|fatte|fath/, skuMatch: (p) => /foul/i.test(p.name) },
    { test: /almond/, skuMatch: (p) => /almond/i.test(p.name) },
    { test: /cheese/, skuMatch: (p) => /cheese/i.test(p.name) },
    { test: /bite|croissant/, skuMatch: (p) => /croissant|bite/i.test(p.name) },
    { test: /ice cream|sundae/, skuMatch: (p) => /ice cream|sundae/i.test(p.name) },
  ];

  for (const rule of rules) {
    if (!rule.test.test(lower)) continue;
    const hit = products.find(rule.skuMatch);
    if (hit) return hit;
  }

  return products.find((p) => /foul/i.test(p.name)) || products[0];
}

async function ensureWalkInCustomer(db, storeId) {
  const snap = await db
    .collection('customers')
    .where('storeId', '==', storeId)
    .where('name', '==', 'Walk-in')
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  if (!write) {
    console.log('  [dry-run] would create Walk-in customer');
    return 'walk-in-customer';
  }

  const ref = await db.collection('customers').add({
    storeId,
    name: 'Walk-in',
    phone: '00000000',
    email: '',
    createdAt: nowIso(),
    notes: 'POS / notebook walk-in sales',
  });
  console.log('  created Walk-in customer', ref.id);
  return ref.id;
}

async function loadProducts(db, storeId) {
  const snap = await db.collection('products').where('storeId', '==', storeId).get();
  return snap.docs.map((d) => ({
    id: d.id,
    name: String(d.data().name || ''),
    price: Number(d.data().price || d.data().sellingPrice || 0),
  }));
}

async function findExistingOrder(db, storeId, importSource) {
  const snap = await db
    .collection('orders')
    .where('storeId', '==', storeId)
    .where('importSource', '==', importSource)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function findExistingExpense(db, storeId, importSource) {
  const snap = await db
    .collection('stores')
    .doc(storeId)
    .collection('financeExpenses')
    .where('importSource', '==', importSource)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function nextInvoiceNumber(db, storeId) {
  const profileRef = db.collection('storeProfiles').doc(storeId);
  const profileSnap = await profileRef.get();
  const profile = profileSnap.data() || {};
  const prefix = profile.invoiceNumberPrefix || 'INV';
  const last = Number(profile.lastInvoiceNumber || 0);
  const next = last + 1;
  const invoiceNumber = `${prefix}-${String(next).padStart(3, '0')}`;
  return { invoiceNumber, next, profileRef };
}

async function main() {
  if (!fs.existsSync(LEDGER_PATH)) {
    throw new Error(`Missing ledger file: ${LEDGER_PATH}`);
  }
  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  const storeId = ledger.storeId;

  const saPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(saPath)) throw new Error('serviceAccountKey.json not found');
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'market-flow-7b074' });
  }
  const db = admin.firestore();

  const products = await loadProducts(db, storeId);
  if (!products.length) throw new Error('No products found for store');

  const customerId = await ensureWalkInCustomer(db, storeId);

  console.log(`Mode: ${write ? 'WRITE' : 'DRY-RUN'}`);
  console.log(`Store: ${storeId}`);
  console.log(`Products loaded: ${products.length}`);

  let invoiceCursor = null;

  async function reserveInvoiceNumber() {
    if (!invoiceCursor) {
      invoiceCursor = await nextInvoiceNumber(db, storeId);
    } else {
      invoiceCursor.next += 1;
      const prefix =
        (await db.collection('storeProfiles').doc(storeId).get()).data()?.invoiceNumberPrefix || 'INV';
      invoiceCursor.invoiceNumber = `${prefix}-${String(invoiceCursor.next).padStart(3, '0')}`;
    }
    return invoiceCursor.invoiceNumber;
  }

  async function importLedgerOrder(orderInput) {
    const sales = Array.isArray(orderInput.sales) ? orderInput.sales : [];
    if (!sales.length) {
      console.log(`\nSkip order ${orderInput.date} — no sales lines`);
      return 0;
    }

    const importSource = orderInput.importSource || `jinan-daily-ledger-${orderInput.date}`;
    const existing = await findExistingOrder(db, storeId, importSource);
    if (existing) {
      console.log(`SKIP order ${orderInput.date} — already imported (${existing.id})`);
      return 0;
    }

    const items = sales.map((sale) => {
      const product = matchProduct(sale.label, products);
      return {
        productId: product.id,
        productName: sale.label,
        quantity: 1,
        price: round2(sale.amountUSD),
      };
    });

    const subtotal = round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const total = subtotal;
    const amountPaid =
      orderInput.amountPaid != null ? round2(orderInput.amountPaid) : total;
    const remainingAmount = round2(Math.max(0, total - amountPaid));
    const paymentStatus =
      orderInput.paymentStatus ||
      (remainingAmount <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid');

    const invoiceNumber = await reserveInvoiceNumber();
    const paymentHistory =
      amountPaid > 0
        ? [
            {
              id: `PMT-LEDGER-${importSource}`,
              amount: amountPaid,
              entryType: 'payment',
              date: orderInput.date,
              method: 'cash',
              notes: orderInput.paymentNotes || `Notebook import (${ledger.source})`,
              recordedBy: 'importJinanDailyLedger',
              recordedAt: nowIso(),
            },
          ]
        : [];

    const orderDoc = {
      storeId,
      customerId,
      customerName: orderInput.customerName || 'Walk-in',
      customerPhone: orderInput.customerPhone || '00000000',
      invoiceNumber,
      items,
      subtotal,
      taxType: 'none',
      taxRate: 0,
      taxAmount: 0,
      discountType: 'percentage',
      discountValue: 0,
      discountAmount: 0,
      total,
      status: 'delivered',
      paymentStatus,
      amountPaid,
      remainingAmount,
      paymentDate: amountPaid > 0 ? orderInput.date : null,
      paymentMethod: 'cash',
      paymentNotes: orderInput.paymentNotes || `Notebook sales ${orderInput.date}`,
      paymentHistory,
      deliveryMethod: 'pickup',
      deliveryFee: 0,
      createdAt: dateAtNoonUtc(orderInput.date),
      updatedAt: nowIso(),
      createdBy: 'importJinanDailyLedger',
      importSource,
      invoiceNotes:
        orderInput.invoiceNotes || `Imported from handwritten ledger — ${orderInput.date}`,
      orderChannel: 'pos',
    };

    console.log(
      `\nOrder ${orderInput.date}: ${invoiceNumber} — ${items.length} lines — total $${total} — ${paymentStatus} ($${amountPaid} paid)`,
    );

    if (write) {
      const ref = await db.collection('orders').add(orderDoc);
      console.log(`  created order ${ref.id}`);
    }

    return total;
  }

  const days = ledger.days || [];
  const additionalOrders = ledger.additionalOrders || [];
  let importedSalesTotal = 0;

  for (const day of days) {
    importedSalesTotal += await importLedgerOrder(day);
  }

  for (const order of additionalOrders) {
    importedSalesTotal += await importLedgerOrder(order);
  }

  if (write && invoiceCursor) {
    await invoiceCursor.profileRef.set(
      { lastInvoiceNumber: invoiceCursor.next, updatedAt: nowIso() },
      { merge: true },
    );
    console.log(`\nUpdated lastInvoiceNumber → ${invoiceCursor.next}`);
  }

  const expenses = ledger.expenses || [];
  let expenseIndex = 0;
  for (const expense of expenses) {
    expenseIndex += 1;
    const importSource =
      expense.importSource || `jinan-daily-ledger-expense-${expense.date}-${expenseIndex}`;
    const existing = await findExistingExpense(db, storeId, importSource);
    if (existing) {
      console.log(`SKIP expense ${expense.label} — already imported`);
      continue;
    }

    const expenseId = `JNL-EXP-${expense.date}-${String(expenseIndex).padStart(2, '0')}`;
    const amount = round2(expense.amountUSD);
    const expenseDoc = {
      storeId,
      name: expense.label,
      description: expense.label,
      category: expense.category,
      type: 'one-time',
      amount,
      startDate: expense.date,
      expenseDate: expense.date,
      paymentMethod: 'cash',
      status: 'paid',
      paidAmount: amount,
      notes: expense.notes
        ? `${expense.notes} — imported from handwritten ledger (${ledger.source})`
        : `Imported from handwritten ledger (${ledger.source})`,
      importSource,
      createdAt: dateAtNoonUtc(expense.date),
      updatedAt: nowIso(),
    };

    console.log(`\nExpense: ${expense.label} — $${amount} — ${expense.date}`);

    if (write) {
      await db
        .collection('stores')
        .doc(storeId)
        .collection('financeExpenses')
        .doc(expenseId)
        .set(expenseDoc, { merge: true });
      console.log(`  created financeExpense ${expenseId}`);
    }
  }

  const salesTotal = round2(importedSalesTotal);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amountUSD, 0);
  const orderCount =
    days.filter((d) => (d.sales || []).length).length +
    additionalOrders.filter((d) => (d.sales || []).length).length;

  console.log('\n--- Summary ---');
  console.log(`Sales total: $${salesTotal} (${orderCount} orders)`);
  console.log(`Expenses total: $${round2(expenseTotal)} (${expenses.length} lines)`);
  console.log(write ? 'Done.' : 'Dry-run complete — re-run with --write to apply.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
