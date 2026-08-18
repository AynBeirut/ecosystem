import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS, type FinanceCollectionKey } from './paths';

const nowIso = () => new Date().toISOString();

/** Firestore rejects `undefined` field values — strip them recursively before writes. */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return data;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = sanitizeForFirestore(value);
  }
  return out as T;
}

function colRef(storeId: string, key: FinanceCollectionKey) {
  return collection(getFinanceDb(), 'stores', storeId, FINANCE_COLLECTIONS[key]);
}

export async function listStoreCollection<T extends { id: string }>(
  storeId: string,
  key: FinanceCollectionKey,
): Promise<T[]> {
  const snap = await getDocs(colRef(storeId, key));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** Replace a store subcollection with the given items (by id). */
export async function replaceStoreCollection(
  storeId: string,
  key: FinanceCollectionKey,
  items: Array<{ id: string } & Record<string, unknown>>,
): Promise<void> {
  const col = colRef(storeId, key);
  const snap = await getDocs(col);
  const keep = new Set(items.map((i) => i.id));
  const batch = writeBatch(getFinanceDb());
  const ts = nowIso();

  snap.docs.forEach((d) => {
    if (!keep.has(d.id)) batch.delete(d.ref);
  });

  items.forEach((item) => {
    const { id, ...rest } = item;
    batch.set(
      doc(col, id),
      sanitizeForFirestore({ ...rest, storeId, updatedAt: ts }),
      { merge: true },
    );
  });

  await batch.commit();
}

export async function loadCashBalance(storeId: string): Promise<Record<string, unknown> | null> {
  const ref = doc(getFinanceDb(), 'stores', storeId, 'financeSettings', 'cashBalance');
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function saveCashBalance(storeId: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(
    doc(getFinanceDb(), 'stores', storeId, 'financeSettings', 'cashBalance'),
    sanitizeForFirestore({ ...data, storeId, updatedAt: nowIso() }),
    { merge: true },
  );
}

export async function upsertStoreDoc(
  storeId: string,
  key: FinanceCollectionKey,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await setDoc(
    doc(colRef(storeId, key), id),
    sanitizeForFirestore({ ...data, storeId, updatedAt: nowIso() }),
    { merge: true },
  );
}

export async function removeStoreDoc(
  storeId: string,
  key: FinanceCollectionKey,
  id: string,
): Promise<void> {
  await deleteDoc(doc(colRef(storeId, key), id));
}
