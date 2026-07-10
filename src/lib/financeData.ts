import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';

/** Canonical expense records for a store (financeExpenses — GL source of truth). */
export async function fetchFinanceExpenses(db: Firestore, storeId: string) {
  const snap = await getDocs(
    query(collection(db, 'stores', storeId, 'financeExpenses'), where('storeId', '==', storeId)),
  );
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const amount = Number(data.amount ?? 0);
    const date = String(
      data.startDate ?? data.expenseDate ?? data.date ?? data.createdAt ?? new Date().toISOString(),
    );
    return {
      id: d.id,
      date,
      category: String(data.category ?? 'other'),
      amount,
      description: String(data.name ?? data.description ?? ''),
      paymentMethod: String(data.paymentMethod ?? 'cash'),
      storeId,
      ...data,
    };
  });
}

export function financeExpensesCollection(db: Firestore, storeId: string) {
  return collection(db, 'stores', storeId, 'financeExpenses');
}

/** Platform purchases (canonical PO / receiving). */
export async function fetchPlatformPurchases(db: Firestore, storeId: string) {
  const snap = await getDocs(
    query(collection(db, 'purchases'), where('storeId', '==', storeId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
