#!/usr/bin/env node
/**
 * Migrate legacy duplicate finance data to canonical paths (all stores).
 * - financeSuppliers → suppliers
 * - financePurchaseOrders + purchaseOrders → purchases
 * - admin expenses + operationalExpenses → financeExpenses
 *
 * Usage:
 *   node scripts/migrateCanonicalFinanceData.cjs
 *   node scripts/migrateCanonicalFinanceData.cjs --store=STORE_ID
 */
const admin = require('firebase-admin');
const path = require('path');

const storeArg = process.argv.find((a) => a.startsWith('--store='));
const onlyStore = storeArg ? storeArg.split('=')[1] : null;

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'market-flow-7b074' });
}

const db = admin.firestore();
const ts = () => new Date().toISOString();

function supplierKey(name) {
  return String(name || '').trim().toLowerCase();
}

function mapFinanceStatus(s) {
  const v = String(s || 'draft').toLowerCase();
  if (v === 'fulfilled') return 'received';
  if (v === 'approved') return 'confirmed';
  if (v === 'sent') return 'sent';
  return 'draft';
}

function financeItemsToPlatform(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const qty = Number(item.quantity) || 0;
    const unit = Number(item.unitPrice ?? item.rawPrice ?? item.unitCost ?? 0) || 0;
    const subtotal = Number(item.subtotal ?? qty * unit) || 0;
    return {
      materialName: String(item.description || item.materialName || 'Item'),
      sku: String(item.sku || ''),
      quantity: qty,
      unitCost: unit,
      unitPrice: unit,
      subtotal,
      totalPrice: subtotal,
    };
  });
}

async function listStoreIds() {
  if (onlyStore) return [onlyStore];
  const snap = await db.collection('storeProfiles').get();
  return snap.docs.map((d) => d.id);
}

async function migrateSuppliers(storeId) {
  const platformSnap = await db.collection('suppliers').where('storeId', '==', storeId).get();
  const byName = new Map();
  platformSnap.docs.forEach((d) => byName.set(supplierKey(d.data().name), d.id));

  const legacySnap = await db.collection('stores').doc(storeId).collection('financeSuppliers').get();
  let migrated = 0;
  const batch = db.batch();
  for (const doc of legacySnap.docs) {
    const data = doc.data();
    const name = String(data.name || '').trim();
    if (!name || byName.has(supplierKey(name))) continue;
    const ref = db.collection('suppliers').doc();
    batch.set(ref, {
      storeId,
      name,
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      contactPerson: data.contactPerson || name,
      supplierCode: `SUP-${doc.id.slice(0, 8)}`,
      status: 'active',
      migratedFromFinanceSupplierId: doc.id,
      migratedAt: ts(),
      createdAt: data.createdAt || ts(),
      updatedAt: ts(),
    });
    byName.set(supplierKey(name), ref.id);
    migrated++;
  }
  if (migrated) await batch.commit();
  return migrated;
}

async function migratePurchases(storeId) {
  const platformSnap = await db.collection('purchases').where('storeId', '==', storeId).get();
  const existing = new Set(platformSnap.docs.map((d) => d.id));
  let migrated = 0;
  const batch = db.batch();

  const finSnap = await db.collection('stores').doc(storeId).collection('financePurchaseOrders').get();
  for (const doc of finSnap.docs) {
    if (existing.has(doc.id)) continue;
    const data = doc.data();
    const items = financeItemsToPlatform(data.lineItems || data.items);
    const amount = Number(data.amount ?? 0) || items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    batch.set(db.collection('purchases').doc(doc.id), {
      storeId,
      supplierId: data.supplierId || null,
      supplierName: data.supplierName || '',
      items,
      subtotal: amount,
      taxAmount: 0,
      discount: 0,
      total: amount,
      totalCost: amount,
      totalAmount: amount,
      purchaseOrderNumber: doc.id,
      poNumber: doc.id,
      status: mapFinanceStatus(data.status),
      orderDate: data.date || data.createdAt || ts(),
      paymentStatus: 'unpaid',
      notes: data.notes || null,
      migratedFromFinancePo: true,
      migratedAt: ts(),
      createdAt: data.createdAt || ts(),
      updatedAt: ts(),
    });
    existing.add(doc.id);
    migrated++;
  }

  const legacySnap = await db.collection('purchaseOrders').where('storeId', '==', storeId).get();
  for (const doc of legacySnap.docs) {
    if (existing.has(doc.id)) continue;
    const data = doc.data();
    batch.set(db.collection('purchases').doc(doc.id), {
      ...data,
      storeId,
      migratedFromLegacyPurchaseOrders: true,
      migratedAt: ts(),
      updatedAt: ts(),
    }, { merge: true });
    migrated++;
  }

  if (migrated) await batch.commit();
  return migrated;
}

async function migrateExpenses(storeId) {
  const finCol = db.collection('stores').doc(storeId).collection('financeExpenses');
  const existing = new Set((await finCol.get()).docs.map((d) => d.id));
  let migrated = 0;
  const batch = db.batch();

  const adminSnap = await db.collection('expenses').where('storeId', '==', storeId).get();
  for (const doc of adminSnap.docs) {
    const id = `adm-${doc.id}`;
    if (existing.has(id)) continue;
    const data = doc.data();
    const amount = Number(data.amount ?? 0);
    const date = String(data.date ?? data.createdAt ?? ts());
    batch.set(finCol.doc(id), {
      storeId,
      name: String(data.description || data.name || 'Expense'),
      description: String(data.description || ''),
      category: String(data.category || 'other'),
      type: data.isRecurring || data.recurring ? 'recurring' : 'one-time',
      amount,
      startDate: date,
      expenseDate: date,
      paymentMethod: String(data.paymentMethod || 'cash'),
      status: 'paid',
      paidAmount: amount,
      migratedFromAdminExpenseId: doc.id,
      migratedAt: ts(),
      createdAt: data.createdAt || ts(),
      updatedAt: ts(),
    });
    migrated++;
  }

  const opsSnap = await db.collection('stores').doc(storeId).collection('financeOperationalExpenses').get();
  for (const doc of opsSnap.docs) {
    const id = `ops-${doc.id}`;
    if (existing.has(id)) continue;
    batch.set(finCol.doc(id), {
      storeId,
      ...doc.data(),
      migratedFromOperationalExpenseId: doc.id,
      migratedAt: ts(),
      updatedAt: ts(),
    });
    migrated++;
  }

  if (migrated) await batch.commit();
  return migrated;
}

async function main() {
  const storeIds = await listStoreIds();
  console.log(`Migrating ${storeIds.length} store(s)...`);
  let totals = { suppliers: 0, purchases: 0, expenses: 0 };
  for (const storeId of storeIds) {
    const s = await migrateSuppliers(storeId);
    const p = await migratePurchases(storeId);
    const e = await migrateExpenses(storeId);
    totals.suppliers += s;
    totals.purchases += p;
    totals.expenses += e;
    if (s || p || e) {
      console.log(`[${storeId}] suppliers:+${s} purchases:+${p} expenses:+${e}`);
      await db.collection('stores').doc(storeId).collection('financeSettings').doc('canonicalMigration').set({
        storeId,
        suppliersAt: ts(),
        purchasesAt: ts(),
        expensesAt: ts(),
        updatedAt: ts(),
      }, { merge: true });
    }
  }
  console.log('Done.', totals);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
