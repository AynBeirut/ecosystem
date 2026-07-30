import { collection, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { SettlementAllocationInput, VoucherLineSettlement } from '@/types/generalLedger';

const nowIso = () => new Date().toISOString();

function settlementsCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'voucherLineSettlements');
}

export async function loadSettlements(storeId: string): Promise<VoucherLineSettlement[]> {
  const snap = await getDocs(settlementsCol(storeId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoucherLineSettlement, 'id'>) }));
}

export async function loadSettlementsForEntry(storeId: string, paymentEntryId: string): Promise<VoucherLineSettlement[]> {
  const snap = await getDocs(query(settlementsCol(storeId), where('paymentEntryId', '==', paymentEntryId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoucherLineSettlement, 'id'>) }));
}

export async function loadSettlementsForDocument(
  storeId: string,
  documentId: string,
): Promise<VoucherLineSettlement[]> {
  const snap = await getDocs(query(settlementsCol(storeId), where('documentId', '==', documentId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VoucherLineSettlement, 'id'>) }));
}

export async function saveSettlementsForEntry(
  storeId: string,
  paymentEntryId: string,
  allocations: SettlementAllocationInput[],
  createdBy?: string,
): Promise<VoucherLineSettlement[]> {
  const batch = writeBatch(getFinanceDb());
  const now = nowIso();
  const saved: VoucherLineSettlement[] = [];

  for (const alloc of allocations) {
    if (alloc.allocatedAmountBase <= 0) continue;
    const id = `STL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const row = sanitizeForFirestore({
      id,
      storeId,
      paymentEntryId,
      documentId: alloc.documentId,
      documentType: alloc.documentType,
      allocatedAmountBase: alloc.allocatedAmountBase,
      allocatedAmountFx: alloc.allocatedAmountFx ?? alloc.allocatedAmountBase,
      createdAt: now,
      createdBy,
    }) as VoucherLineSettlement;
    batch.set(doc(settlementsCol(storeId), id), row);
    saved.push(row);
  }

  if (saved.length) await batch.commit();
  return saved;
}
