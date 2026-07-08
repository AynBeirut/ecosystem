import { doc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/client';
import { FINANCE_COLLECTIONS } from './paths';
import {
  listStoreCollection,
  removeStoreDoc,
  upsertStoreDoc,
} from './storeCollection';

export type PaymentMethodType = 'stripe' | 'paypal' | 'wish' | 'omt' | 'bank' | 'card';

export type FinancePaymentMethod = {
  id: string;
  storeId?: string;
  type: PaymentMethodType;
  label: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const nowIso = () => new Date().toISOString();

export async function listPaymentMethods(storeId: string, activeOnly = false): Promise<FinancePaymentMethod[]> {
  const rows = await listStoreCollection<FinancePaymentMethod>(storeId, 'paymentMethods');
  const sorted = rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return activeOnly ? sorted.filter((r) => r.is_active) : sorted;
}

export async function createPaymentMethod(
  storeId: string,
  data: Omit<FinancePaymentMethod, 'id' | 'created_at' | 'updated_at'>,
): Promise<FinancePaymentMethod> {
  const id = doc(db, 'stores', storeId, FINANCE_COLLECTIONS.paymentMethods).id;
  const ts = nowIso();
  const row: FinancePaymentMethod = {
    ...data,
    id,
    created_at: ts,
    updated_at: ts,
  };
  await upsertStoreDoc(storeId, 'paymentMethods', id, row as unknown as Record<string, unknown>);
  return row;
}

export async function updatePaymentMethod(
  storeId: string,
  id: string,
  updates: Partial<FinancePaymentMethod>,
): Promise<void> {
  await upsertStoreDoc(storeId, 'paymentMethods', id, {
    ...updates,
    updated_at: nowIso(),
  } as Record<string, unknown>);
}

export async function deletePaymentMethod(storeId: string, id: string): Promise<void> {
  await removeStoreDoc(storeId, 'paymentMethods', id);
}
