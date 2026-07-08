import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS, type FinanceCollectionKey } from './paths';

const nowIso = () => new Date().toISOString();

function colRef(storeId: string, key: FinanceCollectionKey) {
  return collection(db, 'stores', storeId, FINANCE_COLLECTIONS[key]);
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
  const batch = writeBatch(db);
  const ts = nowIso();

  snap.docs.forEach((d) => {
    if (!keep.has(d.id)) batch.delete(d.ref);
  });

  items.forEach((item) => {
    const { id, ...rest } = item;
    batch.set(doc(col, id), { ...rest, storeId, updatedAt: ts }, { merge: true });
  });

  await batch.commit();
}

export async function loadCashBalance(storeId: string): Promise<Record<string, unknown> | null> {
  const ref = doc(db, 'stores', storeId, 'financeSettings', 'cashBalance');
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function saveCashBalance(storeId: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(
    doc(db, 'stores', storeId, 'financeSettings', 'cashBalance'),
    { ...data, storeId, updatedAt: nowIso() },
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
    { ...data, storeId, updatedAt: nowIso() },
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
