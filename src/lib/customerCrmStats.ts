import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import { isCountedSaleStatus } from '@/lib/salesRules';

export interface CustomerOperationalStats {
  totalOrders: number;
  lifetimeValue: number;
}

type Accumulator = {
  orderCount: number;
  invoiceCount: number;
  receiptCount: number;
  debits: number;
  credits: number;
};

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureAccumulator(
  map: Map<string, Accumulator>,
  customerId: string,
): Accumulator | null {
  const id = String(customerId || '').trim();
  if (!id) return null;
  const existing = map.get(id);
  if (existing) return existing;
  const created: Accumulator = {
    orderCount: 0,
    invoiceCount: 0,
    receiptCount: 0,
    debits: 0,
    credits: 0,
  };
  map.set(id, created);
  return created;
}

/**
 * Batch-compute list-card stats from live orders + finance docs (matches statement sources).
 */
export async function loadStoreCustomerOperationalStats(
  storeId: string,
): Promise<Map<string, CustomerOperationalStats>> {
  const db = getFirestore();
  const accumulators = new Map<string, Accumulator>();

  const [ordersSnap, invoicesSnap, receiptsSnap] = await Promise.all([
    getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId))),
    getDocs(collection(db, 'stores', storeId, 'financeInvoices')),
    getDocs(collection(db, 'stores', storeId, 'financeReceipts')),
  ]);

  ordersSnap.forEach((orderDoc) => {
    const order = orderDoc.data();
    if (!isCountedSaleStatus(String(order.status || ''))) return;
    const customerId = String(order.customerId || '').trim();
    const acc = ensureAccumulator(accumulators, customerId);
    if (!acc) return;
    const total = toFiniteNumber(order.totalAmount ?? order.total, 0);
    const paid =
      order.paymentStatus === 'paid'
        ? Math.max(total, toFiniteNumber(order.amountPaid, 0))
        : toFiniteNumber(order.amountPaid, 0);
    acc.orderCount += 1;
    acc.debits += total;
    acc.credits += paid;
  });

  invoicesSnap.forEach((invDoc) => {
    const inv = invDoc.data();
    const clientId = String(inv.clientId || '').trim();
    const acc = ensureAccumulator(accumulators, clientId);
    if (!acc) return;
    const total = toFiniteNumber(inv.total ?? inv.amount, 0);
    if (total <= 0) return;
    acc.invoiceCount += 1;
    acc.debits += total;
  });

  receiptsSnap.forEach((rcptDoc) => {
    const rcpt = rcptDoc.data();
    const clientId = String(rcpt.clientId || '').trim();
    const acc = ensureAccumulator(accumulators, clientId);
    if (!acc) return;
    const amount = toFiniteNumber(rcpt.amount, 0);
    if (amount <= 0) return;
    acc.receiptCount += 1;
    acc.credits += amount;
  });

  const result = new Map<string, CustomerOperationalStats>();
  accumulators.forEach((acc, customerId) => {
    const activityCount = acc.orderCount + acc.invoiceCount + acc.receiptCount;
    const lifetimeValue = acc.debits > 0 ? acc.debits : acc.credits;
    result.set(customerId, {
      totalOrders: activityCount,
      lifetimeValue,
    });
  });

  return result;
}
