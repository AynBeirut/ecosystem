import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getFinanceDb, getFinanceAuth, getFinanceAuthReady } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { LedgerCostCenter } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

function costCentersCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'ledgerCostCenters');
}

export async function loadCostCenters(storeId: string): Promise<LedgerCostCenter[]> {
  if (!storeId) return [];
  const snap = await getDocs(query(costCentersCol(storeId), orderBy('code')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerCostCenter, 'id'>) }));
}

export async function saveCostCenter(
  storeId: string,
  center: Omit<LedgerCostCenter, 'storeId' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<string> {
  await getFinanceAuthReady();
  if (!getFinanceAuth().currentUser?.uid) throw new Error('Not signed in.');
  if (!storeId?.trim()) throw new Error('Store not loaded.');

  const now = nowIso();
  const id = center.id || doc(costCentersCol(storeId)).id;
  const ref = doc(costCentersCol(storeId), id);
  const prev = center.id ? await getDoc(ref) : null;
  await setDoc(
    ref,
    sanitizeForFirestore({
      ...center,
      id,
      storeId,
      createdAt: prev?.exists() ? String((prev.data() as LedgerCostCenter).createdAt || now) : now,
      updatedAt: now,
    }),
    { merge: true },
  );
  return id;
}

export async function deleteCostCenter(storeId: string, id: string): Promise<void> {
  await deleteDoc(doc(getFinanceDb(), 'stores', storeId, 'ledgerCostCenters', id));
}
