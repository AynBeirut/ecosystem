/**
 * Firestore CRUD helpers — Phase A0 scaffold.
 * Phase A1 replaces supabaseOps calls in AppContext with these functions.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { toast } from 'sonner';
import { getReadableError } from '@/lib/getReadableError';
import { retryRequest } from '@/lib/retryRequest';
import { FINANCE_COLLECTIONS, type FinanceCollectionKey } from './paths';

type LogPrefix = string;

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const blockOffline = (op: string): boolean => {
  if (isOffline()) {
    toast.error('You are offline. Changes cannot be saved.');
    console.warn(`[firestoreOps][${op}] blocked: offline`);
    return true;
  }
  return false;
};

const reportError = (prefix: LogPrefix, op: string, err: unknown) => {
  console.error(`[${prefix}][${op}] Firestore error:`, err);
  toast.error(getReadableError(err));
};

function financeCol(storeId: string, key: FinanceCollectionKey) {
  return collection(db, 'stores', storeId, FINANCE_COLLECTIONS[key]);
}

export async function fsListByStore<T extends DocumentData>(
  storeId: string,
  key: FinanceCollectionKey,
): Promise<T[]> {
  const snap = await getDocs(financeCol(storeId, key));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function fsInsert(
  storeId: string,
  key: FinanceCollectionKey,
  data: DocumentData,
  prefix: LogPrefix,
): Promise<string | false> {
  if (blockOffline('insert')) return false;
  try {
    const ref = await retryRequest(async () => addDoc(financeCol(storeId, key), data));
    return ref.id;
  } catch (err) {
    reportError(prefix, 'insert', err);
    return false;
  }
}

export async function fsSet(
  storeId: string,
  key: FinanceCollectionKey,
  id: string,
  data: DocumentData,
  prefix: LogPrefix,
): Promise<boolean> {
  if (blockOffline('set')) return false;
  try {
    await retryRequest(async () => {
      await updateDoc(doc(financeCol(storeId, key), id), data);
    });
    return true;
  } catch (err) {
    reportError(prefix, 'set', err);
    return false;
  }
}

export async function fsDelete(
  storeId: string,
  key: FinanceCollectionKey,
  id: string,
  prefix: LogPrefix,
): Promise<boolean> {
  if (blockOffline('delete')) return false;
  try {
    await retryRequest(async () => deleteDoc(doc(financeCol(storeId, key), id)));
    return true;
  } catch (err) {
    reportError(prefix, 'delete', err);
    return false;
  }
}

export async function fsListCustomers<T extends DocumentData>(storeId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, 'customers'), where('storeId', '==', storeId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export async function fsListProducts<T extends DocumentData>(storeId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db, 'products'), where('storeId', '==', storeId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}
