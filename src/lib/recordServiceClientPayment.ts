import { addDoc, collection, type Firestore } from 'firebase/firestore';
import { assertAccountPaymentAllowed } from '@grabio/lib/accountPaymentGuard';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type RecordServiceClientPaymentInput = {
  storeId: string;
  accountId: string;
  accountName: string;
  amount: number;
  date: string;
  method: string;
  notes?: string;
  createdBy: string;
  createdByName?: string;
};

export function buildServicePaymentFingerprint(
  storeId: string,
  accountId: string,
  accountName: string,
  amount: number,
  date: string,
  method: string,
): string {
  return [
    storeId,
    accountId,
    accountName.trim().toLowerCase(),
    'customer',
    'in',
    date.slice(0, 10),
    round2(amount).toFixed(2),
    String(method || 'cash').toLowerCase(),
  ].join('|');
}

/** Writes accountPayments — cloud function auto-posts RV + financeReceipt. */
export async function recordServiceClientPayment(
  db: Firestore,
  input: RecordServiceClientPaymentInput,
): Promise<{ paymentId: string }> {
  const amount = round2(input.amount);
  if (amount <= 0) throw new Error('Enter a valid amount.');
  if (!input.date) throw new Error('Select a payment date.');
  if (!input.accountId) throw new Error('Client account is required.');

  const fingerprint = buildServicePaymentFingerprint(
    input.storeId,
    input.accountId,
    input.accountName,
    amount,
    input.date,
    input.method,
  );

  const guard = await assertAccountPaymentAllowed(db, {
    storeId: input.storeId,
    accountId: input.accountId,
    accountName: input.accountName,
    accountType: 'customer',
    direction: 'in',
    amount,
    date: input.date,
    method: input.method,
    fingerprint,
  });
  if (!guard.allowed) throw new Error(guard.reason);

  const idempotencyKey = `${input.storeId}|${fingerprint}|${Date.now()}`;
  const ref = await addDoc(collection(db, 'accountPayments'), {
    storeId: input.storeId,
    accountId: input.accountId,
    accountName: input.accountName,
    accountType: 'customer',
    direction: 'in',
    amount,
    date: input.date.slice(0, 10),
    method: input.method,
    notes: input.notes?.trim() || '',
    idempotencyKey,
    paymentFingerprint: fingerprint,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    createdByName: input.createdByName || '',
  });

  return { paymentId: ref.id };
}
