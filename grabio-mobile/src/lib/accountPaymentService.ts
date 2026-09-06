import firestore from '@react-native-firebase/firestore';
import { isCountedSaleStatus } from './salesRules';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type PaymentMethodKey = 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other';

export const PAYMENT_METHOD_OPTIONS: Array<{ key: PaymentMethodKey; label: string }> = [
  { key: 'cash', label: 'Cash' },
  { key: 'bank_transfer', label: 'Bank transfer' },
  { key: 'card', label: 'Card' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'other', label: 'Other' },
];

export type RecordCustomerPaymentInput = {
  storeId: string;
  accountId: string;
  accountName: string;
  amount: number;
  date: string;
  method: PaymentMethodKey;
  notes?: string;
  createdBy: string;
  createdByName: string;
  sourceOrderId?: string;
};

export type RecordCustomerPaymentResult = {
  paymentId: string;
  appliedAmount: number;
  remainingCredit: number;
  appliedOrderIds: string[];
};

function buildPaymentFingerprint(
  storeId: string,
  accountId: string,
  accountName: string,
  amount: number,
  date: string,
  method: string,
): string {
  const roundedAmount = round2(amount);
  return [
    storeId,
    accountId,
    accountName.trim().toLowerCase(),
    'customer',
    'in',
    date,
    roundedAmount.toFixed(2),
    method,
  ].join('|');
}

function makeIdempotencyKey(fingerprint: string): string {
  return `${fingerprint}|${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function allocateCustomerPaymentToOrders(
  storeId: string,
  paymentId: string,
  accountId: string,
  accountName: string,
  amount: number,
  paymentDate: string,
  paymentMethod: string,
  paymentNotes: string,
  recordedBy: string,
): Promise<{ appliedAmount: number; remainingAmount: number; appliedOrderIds: string[] }> {
  if (amount <= 0) {
    return { appliedAmount: 0, remainingAmount: amount, appliedOrderIds: [] };
  }

  let remainingToAllocate = round2(amount);
  const appliedOrderIds: string[] = [];
  const seenOrderIds = new Set<string>();

  const processDocs = async (
    docs: Array<{ id: string; data: () => Record<string, unknown> }>,
  ) => {
    const orders = docs
      .filter((snapshot) => {
        if (seenOrderIds.has(snapshot.id)) return false;
        seenOrderIds.add(snapshot.id);
        return true;
      })
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
      .filter((order) => isCountedSaleStatus(String(order.status || '')))
      .map((order) => {
        const total = round2(Number(order.total) || 0);
        const currentPaid = round2(Number(order.amountPaid) || 0);
        const due = Math.max(0, round2(total - currentPaid));
        const createdAtValue = order.createdAt || order.date || '';
        const createdAtMs = new Date(String(createdAtValue)).getTime() || 0;
        return { order, total, currentPaid, due, createdAtMs };
      })
      .filter((entry) => entry.due > 0)
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (const entry of orders) {
      if (remainingToAllocate <= 0) break;

      const allocated = Math.min(entry.due, remainingToAllocate);
      const roundedAllocated = round2(allocated);
      if (roundedAllocated <= 0) continue;

      const newAmountPaid = round2(entry.currentPaid + roundedAllocated);
      const newRemainingAmount = Math.max(0, round2(entry.total - newAmountPaid));
      const paymentStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';

      const currentHistory = Array.isArray(entry.order.paymentHistory) ? entry.order.paymentHistory : [];
      const allocationRecord = {
        id: `AP-${paymentId}-${entry.order.id}`,
        amount: roundedAllocated,
        entryType: 'payment' as const,
        date: paymentDate,
        method: paymentMethod,
        notes: paymentNotes || 'Payment from mobile Orders',
        recordedBy,
        recordedAt: new Date().toISOString(),
      };

      await firestore().collection('orders').doc(entry.order.id).update({
        amountPaid: newAmountPaid,
        remainingAmount: newRemainingAmount,
        paymentStatus,
        paymentDate,
        paymentMethod,
        paymentNotes: paymentNotes || '',
        paymentHistory: [...currentHistory, allocationRecord],
        updatedAt: new Date().toISOString(),
      });

      remainingToAllocate = round2(remainingToAllocate - roundedAllocated);
      appliedOrderIds.push(entry.order.id);
    }
  };

  const byCustomerIdSnap = await firestore()
    .collection('orders')
    .where('storeId', '==', storeId)
    .where('customerId', '==', accountId)
    .get();
  await processDocs(byCustomerIdSnap.docs);

  if (remainingToAllocate > 0 && accountName) {
    const byCustomerNameSnap = await firestore()
      .collection('orders')
      .where('storeId', '==', storeId)
      .where('customerName', '==', accountName)
      .get();
    await processDocs(byCustomerNameSnap.docs);
  }

  return {
    appliedAmount: round2(amount - remainingToAllocate),
    remainingAmount: remainingToAllocate,
    appliedOrderIds,
  };
}

/** Credits customer account (accountPayments) — auto-allocates FIFO to open orders. */
export async function recordCustomerAccountPayment(
  input: RecordCustomerPaymentInput,
): Promise<RecordCustomerPaymentResult> {
  const amount = round2(input.amount);
  if (amount <= 0) {
    throw new Error('Enter a valid payment amount.');
  }
  if (!input.date) {
    throw new Error('Select a payment date.');
  }
  if (!input.accountId && !input.accountName) {
    throw new Error('Customer account is required.');
  }

  const accountId = input.accountId || input.accountName;
  const fingerprint = buildPaymentFingerprint(
    input.storeId,
    accountId,
    input.accountName,
    amount,
    input.date,
    input.method,
  );

  const duplicateSnap = await firestore()
    .collection('accountPayments')
    .where('storeId', '==', input.storeId)
    .where('paymentFingerprint', '==', fingerprint)
    .limit(1)
    .get();
  if (!duplicateSnap.empty) {
    throw new Error('This exact payment was already recorded. Pull to refresh.');
  }

  const notes = [
    input.notes?.trim(),
    input.sourceOrderId ? `From order #${input.sourceOrderId.slice(-6).toUpperCase()}` : '',
  ].filter(Boolean).join(' · ') || 'Payment from mobile Orders';

  const paymentDoc = {
    storeId: input.storeId,
    accountId,
    accountName: input.accountName,
    accountType: 'customer' as const,
    direction: 'in' as const,
    amount,
    date: input.date,
    method: input.method,
    notes,
    idempotencyKey: makeIdempotencyKey(fingerprint),
    paymentFingerprint: fingerprint,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    createdByName: input.createdByName,
  };

  const ref = await firestore().collection('accountPayments').add(paymentDoc);

  const allocation = await allocateCustomerPaymentToOrders(
    input.storeId,
    ref.id,
    accountId,
    input.accountName,
    amount,
    input.date,
    input.method,
    notes,
    input.createdByName || 'Mobile',
  );

  await ref.update({
    orderAllocation: {
      appliedAmount: allocation.appliedAmount,
      remainingAmount: allocation.remainingAmount,
      appliedOrderIds: allocation.appliedOrderIds,
      appliedAt: new Date().toISOString(),
    },
  });

  return {
    paymentId: ref.id,
    appliedAmount: allocation.appliedAmount,
    remainingCredit: allocation.remainingAmount,
    appliedOrderIds: allocation.appliedOrderIds,
  };
}

export function getOrderAmountDue(order: {
  total?: number;
  amountPaid?: number;
  paymentStatus?: string;
}): number {
  const total = round2(Number(order.total) || 0);
  const paid = round2(Number(order.amountPaid) || 0);
  if (order.paymentStatus === 'paid' && paid >= total) return 0;
  return Math.max(0, round2(total - paid));
}
