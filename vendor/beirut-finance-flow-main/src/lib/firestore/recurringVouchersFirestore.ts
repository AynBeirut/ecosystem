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
import type { RecurringVoucherTemplate } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

function templatesCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'recurringVoucherTemplates');
}

export async function loadRecurringVoucherTemplates(storeId: string): Promise<RecurringVoucherTemplate[]> {
  if (!storeId) return [];
  const snap = await getDocs(query(templatesCol(storeId), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecurringVoucherTemplate, 'id'>) }));
}

export async function saveRecurringVoucherTemplate(
  storeId: string,
  template: Omit<RecurringVoucherTemplate, 'storeId' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<string> {
  await getFinanceAuthReady();
  if (!getFinanceAuth().currentUser?.uid) throw new Error('Not signed in.');
  if (!storeId?.trim()) throw new Error('Store not loaded.');

  const now = nowIso();
  const id = template.id || doc(templatesCol(storeId)).id;
  const ref = doc(templatesCol(storeId), id);
  const prev = template.id ? await getDoc(ref) : null;
  await setDoc(
    ref,
    sanitizeForFirestore({
      ...template,
      id,
      storeId,
      createdAt: prev?.exists() ? String((prev.data() as RecurringVoucherTemplate).createdAt || now) : now,
      updatedAt: now,
    }),
    { merge: true },
  );
  return id;
}

export async function deleteRecurringVoucherTemplate(storeId: string, id: string): Promise<void> {
  await deleteDoc(doc(getFinanceDb(), 'stores', storeId, 'recurringVoucherTemplates', id));
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function computeNextRunDate(
  frequency: RecurringVoucherTemplate['frequency'],
  fromDate: string,
): string {
  if (frequency === 'monthly') return addMonths(fromDate, 1);
  if (frequency === 'quarterly') return addMonths(fromDate, 3);
  return addMonths(fromDate, 12);
}
