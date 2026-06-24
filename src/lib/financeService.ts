import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

export type FinanceEstimateStatus = 'draft' | 'sent' | 'accepted' | 'converted' | 'expired';

export type FinanceLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  taxRate?: number;
};

export type FinanceEstimate = {
  id?: string;
  number: string;
  clientId: string;
  clientName: string;
  status: FinanceEstimateStatus;
  currency: string;
  lineItems: FinanceLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  validUntil?: string;
  convertedInvoiceId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FinanceReceipt = {
  id?: string;
  number: string;
  invoiceId?: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paidAt: string;
};

function estimatesCol(db: Firestore, storeId: string) {
  return collection(db, 'stores', storeId, 'financeEstimates');
}

function receiptsCol(db: Firestore, storeId: string) {
  return collection(db, 'stores', storeId, 'financeReceipts');
}

function sumLineItems(items: FinanceLineItem[]): { subtotal: number; taxTotal: number; total: number } {
  let subtotal = 0;
  let taxTotal = 0;
  items.forEach((item) => {
    const line = item.qty * item.unitPrice;
    subtotal += line;
    taxTotal += line * ((item.taxRate ?? 0) / 100);
  });
  return { subtotal, taxTotal, total: subtotal + taxTotal };
}

export async function listEstimates(db: Firestore, storeId: string): Promise<FinanceEstimate[]> {
  const snap = await getDocs(query(estimatesCol(db, storeId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FinanceEstimate) }));
}

export async function createEstimate(
  db: Firestore,
  storeId: string,
  input: Omit<FinanceEstimate, 'id' | 'subtotal' | 'taxTotal' | 'total' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const totals = sumLineItems(input.lineItems);
  const ref = await addDoc(estimatesCol(db, storeId), {
    ...input,
    ...totals,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEstimateStatus(
  db: Firestore,
  storeId: string,
  estimateId: string,
  status: FinanceEstimateStatus,
  extra?: Partial<FinanceEstimate>,
): Promise<void> {
  await updateDoc(doc(estimatesCol(db, storeId), estimateId), {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
  });
}

export async function listReceipts(db: Firestore, storeId: string): Promise<FinanceReceipt[]> {
  const snap = await getDocs(query(receiptsCol(db, storeId), orderBy('paidAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FinanceReceipt) }));
}

export async function createReceipt(
  db: Firestore,
  storeId: string,
  input: Omit<FinanceReceipt, 'id'>,
): Promise<string> {
  const ref = await addDoc(receiptsCol(db, storeId), input);
  return ref.id;
}
