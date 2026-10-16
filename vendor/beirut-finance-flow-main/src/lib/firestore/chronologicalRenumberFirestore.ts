/**
 * Rebuild chronological PREFIX-YYYY-MM-DD-000001 fields in Firestore (per type, per store).
 */
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  type BusinessDocumentKind,
  rebuildChronologicalNumbers,
  documentDateKeyFromFields,
  parseCreatedAtMs,
} from '@/lib/chronologicalDocumentNumbers';
import { getFinanceDb } from '@/integrations/firebase/client';

const nowIso = () => new Date().toISOString();

type Row = { id: string; documentDateKey: string; createdAtMs: number };

function pickDate(data: Record<string, unknown>, fields: string[]): unknown {
  for (const f of fields) {
    if (data[f] != null && data[f] !== '') return data[f];
  }
  return null;
}

function toRow(id: string, data: Record<string, unknown>, dateFields: string[]): Row {
  const createdRaw = pickDate(data, ['createdAt', 'updatedAt', 'date']) || data.createdAt;
  const docDate = pickDate(data, dateFields);
  return {
    id,
    documentDateKey: documentDateKeyFromFields(
      docDate as string | Date | null | undefined,
      createdRaw,
    ),
    createdAtMs: parseCreatedAtMs(createdRaw),
  };
}

async function commitUpdates(
  db: Firestore,
  updates: Array<{ refPath: string; fields: Record<string, string> }>,
): Promise<number> {
  if (updates.length === 0) return 0;
  let committed = 0;
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const u of chunk) {
      batch.update(doc(db, u.refPath), { ...u.fields, updatedAt: nowIso() });
    }
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

export async function renumberFinanceInvoices(db: Firestore, storeId: string): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'financeInvoices'));
  const rows = snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>, ['date', 'invoiceDate']));
  const map = rebuildChronologicalNumbers(rows, 'INV');
  const updates = snap.docs
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).invoiceNumber || '');
      if (!next || next === prev) return null;
      return {
        refPath: `stores/${storeId}/financeInvoices/${d.id}`,
        fields: { invoiceNumber: next },
      };
    })
    .filter(Boolean) as Array<{ refPath: string; fields: Record<string, string> }>;
  await commitUpdates(db, updates);
  return map;
}

export async function renumberFinanceEstimates(db: Firestore, storeId: string): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'financeEstimates'));
  const rows = snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>, ['date']));
  const map = rebuildChronologicalNumbers(rows, 'EST');
  const updates = snap.docs
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).estimateNumber || '');
      if (!next || next === prev) return null;
      return {
        refPath: `stores/${storeId}/financeEstimates/${d.id}`,
        fields: { estimateNumber: next },
      };
    })
    .filter(Boolean) as Array<{ refPath: string; fields: Record<string, string> }>;
  await commitUpdates(db, updates);
  return map;
}

export async function renumberFinanceExpenses(db: Firestore, storeId: string): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'financeExpenses'));
  const rows = snap.docs.map((d) =>
    toRow(d.id, d.data() as Record<string, unknown>, ['expenseDate', 'startDate', 'date']),
  );
  const map = rebuildChronologicalNumbers(rows, 'EXP');
  const updates = snap.docs
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).expenseNumber || '');
      if (!next || next === prev) return null;
      return {
        refPath: `stores/${storeId}/financeExpenses/${d.id}`,
        fields: { expenseNumber: next },
      };
    })
    .filter(Boolean) as Array<{ refPath: string; fields: Record<string, string> }>;
  await commitUpdates(db, updates);
  return map;
}

export async function renumberStorePurchases(db: Firestore, storeId: string): Promise<Map<string, string>> {
  const snap = await getDocs(query(collection(db, 'purchases'), where('storeId', '==', storeId)));
  const rows = snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>, ['orderDate', 'date']));
  const map = rebuildChronologicalNumbers(rows, 'PO');
  const updates = snap.docs
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).poNumber || '');
      if (!next || next === prev) return null;
      return {
        refPath: `purchases/${d.id}`,
        fields: { poNumber: next, purchaseOrderNumber: next, invoiceNumber: next },
      };
    })
    .filter(Boolean) as Array<{ refPath: string; fields: Record<string, string> }>;
  await commitUpdates(db, updates);
  return map;
}

export async function renumberStoreOrders(db: Firestore, storeId: string): Promise<Map<string, string>> {
  const snap = await getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId)));
  const rows = snap.docs.map((d) =>
    toRow(d.id, d.data() as Record<string, unknown>, ['posSaleTimestamp', 'date', 'orderDate']),
  );
  const map = rebuildChronologicalNumbers(rows, 'ORD');
  const updates = snap.docs
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).invoiceNumber || '');
      if (!next || next === prev) return null;
      return {
        refPath: `orders/${d.id}`,
        fields: { invoiceNumber: next },
      };
    })
    .filter(Boolean) as Array<{ refPath: string; fields: Record<string, string> }>;
  await commitUpdates(db, updates);
  return map;
}

export async function renumberJournalVouchers(
  db: Firestore,
  storeId: string,
  voucherType: BusinessDocumentKind,
): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, 'stores', storeId, 'journalEntries'));
  const filtered = snap.docs.filter(
    (d) => String((d.data() as Record<string, unknown>).voucherType || '').toUpperCase() === voucherType,
  );
  const rows = filtered.map((d) => toRow(d.id, d.data() as Record<string, unknown>, ['date', 'valueDate']));
  const map = rebuildChronologicalNumbers(rows, voucherType);
  const updates = filtered
    .map((d) => {
      const next = map.get(d.id);
      const prev = String((d.data() as Record<string, unknown>).voucherNumber || '');
      if (!next || next === prev) return null;
      return {
        refPath: `stores/${storeId}/journalEntries/${d.id}`,
        fields: { voucherNumber: next },
      };
    })
    .filter(Boolean) as Array<{ refPath: string; fields: Record<string, string> }>;
  await commitUpdates(db, updates);
  return map;
}

export async function syncFinanceInvoiceNumbers(storeId: string) {
  return renumberFinanceInvoices(getFinanceDb(), storeId);
}

export async function syncFinanceEstimateNumbers(storeId: string) {
  return renumberFinanceEstimates(getFinanceDb(), storeId);
}

export async function syncFinanceExpenseNumbers(storeId: string) {
  return renumberFinanceExpenses(getFinanceDb(), storeId);
}
