import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb, getFinanceAuth, getFinanceAuthReady } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { PcgClientAccount } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

function col(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'pcgClientAccounts');
}

export async function loadPcgClientAccounts(storeId: string): Promise<PcgClientAccount[]> {
  const snap = await getDocs(col(storeId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<PcgClientAccount, 'id'>) }))
    .sort((a, b) => a.clientCode.localeCompare(b.clientCode));
}

export async function savePcgClientAccount(
  storeId: string,
  input: Omit<PcgClientAccount, 'storeId' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<PcgClientAccount> {
  await getFinanceAuthReady();
  const uid = getFinanceAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('Not signed in. Refresh the page and sign in again.');
  }
  if (!storeId?.trim()) {
    throw new Error('Store not loaded yet. Wait a moment and try again.');
  }

  const id = input.id || doc(col(storeId)).id;
  const ref = doc(getFinanceDb(), 'stores', storeId, 'pcgClientAccounts', id);
  const prevSnap = input.id ? await getDoc(ref) : null;
  const payload: PcgClientAccount = {
    id,
    storeId,
    clientCode: String(input.clientCode || '').trim(),
    grabioOperationalCode: String(input.grabioOperationalCode || '').trim(),
    parentPcgCode: input.parentPcgCode?.trim() || undefined,
    name: input.name?.trim() || undefined,
    nameAr: input.nameAr?.trim() || undefined,
    currency: input.currency === 'USD' ? 'USD' : 'LL',
    partyId: input.partyId?.trim() || undefined,
    partyType: input.partyType === 'supplier' ? 'supplier' : input.partyType === 'client' ? 'client' : undefined,
    createdAt: prevSnap?.exists() ? String(prevSnap.data()?.createdAt || nowIso()) : nowIso(),
    updatedAt: nowIso(),
  };

  const { id: _docId, ...firestoreBody } = payload;
  await setDoc(ref, sanitizeForFirestore(firestoreBody as unknown as Record<string, unknown>), { merge: true });
  return payload;
}

export async function deletePcgClientAccount(storeId: string, id: string): Promise<void> {
  await deleteDoc(doc(getFinanceDb(), 'stores', storeId, 'pcgClientAccounts', id));
}

export async function replacePcgClientAccounts(
  storeId: string,
  rows: Array<Omit<PcgClientAccount, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>>,
): Promise<PcgClientAccount[]> {
  const existing = await loadPcgClientAccounts(storeId);
  const batch = writeBatch(getFinanceDb());
  for (const row of existing) {
    batch.delete(doc(getFinanceDb(), 'stores', storeId, 'pcgClientAccounts', row.id));
  }
  const saved: PcgClientAccount[] = [];
  const ts = nowIso();
  for (const row of rows) {
    const id = doc(col(storeId)).id;
    const payload: PcgClientAccount = {
      id,
      storeId,
      clientCode: row.clientCode.trim(),
      grabioOperationalCode: row.grabioOperationalCode.trim(),
      parentPcgCode: row.parentPcgCode?.trim() || undefined,
      name: row.name?.trim() || undefined,
      nameAr: row.nameAr?.trim() || undefined,
      currency: row.currency === 'USD' ? 'USD' : 'LL',
      createdAt: ts,
      updatedAt: ts,
    };
    const { id: _docId, ...firestoreBody } = payload;
    batch.set(
      doc(getFinanceDb(), 'stores', storeId, 'pcgClientAccounts', id),
      sanitizeForFirestore(firestoreBody as unknown as Record<string, unknown>),
    );
    saved.push(payload);
  }
  await batch.commit();
  return saved.sort((a, b) => a.clientCode.localeCompare(b.clientCode));
}
