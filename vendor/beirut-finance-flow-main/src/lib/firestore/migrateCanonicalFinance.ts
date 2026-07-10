/**
 * One-time in-place migration: legacy finance subcollections → canonical platform paths.
 * Does not delete source docs until migrationMeta confirms success.
 */
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS } from './paths';
import {
  mapFinancePurchaseStatus,
  mapFsPlatformPurchase,
  mapFsPurchaseOrder,
  mapFsSupplier,
} from './mappers';
import type { PurchaseOrder, Supplier } from '@/context/AppContext';

const META_DOC = 'canonicalMigration';

type MigrationMeta = {
  suppliersAt?: string;
  purchasesAt?: string;
  expensesAt?: string;
};

const nowIso = () => new Date().toISOString();

async function loadMeta(storeId: string): Promise<MigrationMeta> {
  const ref = doc(getFinanceDb(), 'stores', storeId, 'financeSettings', META_DOC);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as MigrationMeta) : {};
}

async function saveMeta(storeId: string, patch: Partial<MigrationMeta>) {
  await setDoc(
    doc(getFinanceDb(), 'stores', storeId, 'financeSettings', META_DOC),
    { storeId, ...patch, updatedAt: nowIso() },
    { merge: true },
  );
}

function supplierKey(name: string) {
  return name.trim().toLowerCase();
}

function purchaseItemsToPlatform(items: unknown): Record<string, unknown>[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice ?? item.rawPrice ?? item.unitCost ?? 0) || 0;
    const subtotal = Number(item.subtotal ?? qty * unitPrice) || 0;
    return {
      materialName: String(item.description || item.materialName || 'Item'),
      sku: String(item.sku || ''),
      quantity: qty,
      unitCost: unitPrice,
      unitPrice,
      subtotal,
      totalPrice: subtotal,
    };
  });
}

/** financeSuppliers → top-level suppliers (by name dedupe). */
export async function migrateFinanceSuppliersToPlatform(storeId: string): Promise<Supplier[]> {
  const meta = await loadMeta(storeId);
  const platformSnap = await getDocs(
    query(collection(getFinanceDb(), 'suppliers'), where('storeId', '==', storeId)),
  );
  const platformByName = new Map<string, Supplier>();
  platformSnap.docs.forEach((d) => {
      const s = mapFsSupplier(d.id, d.data() as Record<string, unknown>);
      platformByName.set(supplierKey(s.name), s);
    });

  if (meta.suppliersAt) {
    return [...platformByName.values()];
  }

  const legacySnap = await getDocs(
    collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS.suppliers),
  );
  if (legacySnap.empty) {
    await saveMeta(storeId, { suppliersAt: nowIso() });
    return [...platformByName.values()];
  }

  const batch = writeBatch(getFinanceDb());
  const ts = nowIso();

  for (const legacyDoc of legacySnap.docs) {
    const data = legacyDoc.data() as Record<string, unknown>;
    const name = String(data.name || '').trim();
    if (!name) continue;
    const key = supplierKey(name);
    if (platformByName.has(key)) continue;

    const newRef = doc(collection(getFinanceDb(), 'suppliers'));
    const payload = {
      storeId,
      name,
      address: String(data.address || ''),
      phone: String(data.phone || ''),
      email: String(data.email || ''),
      contactPerson: String(data.contactPerson || name),
      supplierCode: `SUP-${legacyDoc.id.slice(0, 8)}`,
      status: 'active',
      migratedFromFinanceSupplierId: legacyDoc.id,
      migratedAt: ts,
      createdAt: data.createdAt || ts,
      updatedAt: ts,
    };
    batch.set(newRef, payload);
    platformByName.set(key, mapFsSupplier(newRef.id, payload));
  }

  await batch.commit();
  await saveMeta(storeId, { suppliersAt: nowIso() });
  return [...platformByName.values()];
}

/** financePurchaseOrders + legacy purchaseOrders → top-level purchases. */
export async function migrateFinancePurchasesToPlatform(storeId: string): Promise<PurchaseOrder[]> {
  const meta = await loadMeta(storeId);
  const platformSnap = await getDocs(
    query(collection(getFinanceDb(), 'purchases'), where('storeId', '==', storeId)),
  );
  const byId = new Map<string, PurchaseOrder>();
  platformSnap.docs.forEach((d) => {
    const po = mapFsPlatformPurchase(d.id, d.data() as Record<string, unknown>);
    byId.set(po.id, po);
  });

  if (meta.purchasesAt) {
    return [...byId.values()];
  }

  const batch = writeBatch(getFinanceDb());
  const ts = nowIso();
  let wrote = false;

  const liftFinancePo = async (sub: 'purchaseOrders') => {
    const snap = await getDocs(collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS[sub]));
    for (const d of snap.docs) {
      if (byId.has(d.id)) continue;
      const fin = mapFsPurchaseOrder(d.id, d.data() as Record<string, unknown>);
      const items = purchaseItemsToPlatform(fin.items);
      const amount = fin.amount || items.reduce((s, i) => s + Number(i.subtotal || 0), 0);
      const payload = {
        storeId,
        supplierId: fin.supplierId || null,
        supplierName: fin.supplierName,
        items,
        subtotal: amount,
        taxAmount: 0,
        discount: 0,
        total: amount,
        totalCost: amount,
        totalAmount: amount,
        purchaseOrderNumber: fin.id,
        poNumber: fin.id,
        status: mapFinancePurchaseStatus(fin.status),
        orderDate: fin.date,
        paymentStatus: 'unpaid',
        notes: fin.notes || null,
        migratedFromFinancePo: true,
        migratedAt: ts,
        createdAt: fin.date,
        updatedAt: ts,
      };
      batch.set(doc(getFinanceDb(), 'purchases', fin.id), payload);
      byId.set(fin.id, mapFsPlatformPurchase(fin.id, payload));
      wrote = true;
    }
  };

  await liftFinancePo('purchaseOrders');

  const legacySnap = await getDocs(
    query(collection(getFinanceDb(), 'purchaseOrders'), where('storeId', '==', storeId)),
  );
  for (const d of legacySnap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (byId.has(d.id)) continue;
    const amount = Number(data.totalCost ?? data.totalAmount ?? data.total ?? 0);
    const payload = {
      ...data,
      storeId,
      total: amount || data.total,
      totalCost: amount || data.totalCost,
      totalAmount: amount || data.totalAmount,
      purchaseOrderNumber: data.purchaseOrderNumber || data.poNumber || d.id,
      migratedFromLegacyPurchaseOrders: true,
      migratedAt: ts,
      updatedAt: ts,
    };
    batch.set(doc(getFinanceDb(), 'purchases', d.id), payload, { merge: true });
    byId.set(d.id, mapFsPlatformPurchase(d.id, payload as Record<string, unknown>));
    wrote = true;
  }

  if (wrote) await batch.commit();
  await saveMeta(storeId, { purchasesAt: nowIso() });
  return [...byId.values()];
}

/** Admin top-level expenses → financeExpenses (GL source of truth). */
export async function migrateAdminExpensesToFinance(storeId: string): Promise<void> {
  const meta = await loadMeta(storeId);
  if (meta.expensesAt) return;

  const [adminSnap, financeSnap, operationalSnap] = await Promise.all([
    getDocs(query(collection(getFinanceDb(), 'expenses'), where('storeId', '==', storeId))),
    getDocs(collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS.expenses)),
    getDocs(collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS.operationalExpenses)),
  ]);

  const existingIds = new Set(financeSnap.docs.map((d) => d.id));
  const batch = writeBatch(getFinanceDb());
  const ts = nowIso();
  let wrote = false;

  const writeExpense = (id: string, payload: Record<string, unknown>) => {
    if (existingIds.has(id)) return;
    batch.set(doc(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS.expenses, id), {
      storeId,
      ...payload,
      updatedAt: ts,
    });
    existingIds.add(id);
    wrote = true;
  };

  adminSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const amount = Number(data.amount ?? 0);
    const date = String(data.date ?? data.createdAt ?? ts);
    writeExpense(`adm-${d.id}`, {
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
      notes: data.notes || null,
      migratedFromAdminExpenseId: d.id,
      migratedAt: ts,
      createdAt: data.createdAt || ts,
    });
  });

  operationalSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    writeExpense(`ops-${d.id}`, {
      ...data,
      migratedFromOperationalExpenseId: d.id,
      migratedAt: ts,
      createdAt: data.createdAt || ts,
    });
  });

  if (wrote) await batch.commit();
  await saveMeta(storeId, { expensesAt: nowIso() });
}
