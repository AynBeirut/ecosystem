import {
  collection,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type AccountPaymentGuardInput = {
  storeId: string;
  accountId: string;
  accountName: string;
  accountType: 'customer' | 'supplier';
  direction: 'in' | 'out';
  amount: number;
  date: string;
  method: string;
  fingerprint: string;
};

export type AccountPaymentGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function isCashSaleMethod(method: unknown): boolean {
  const pm = String(method || 'cash').toLowerCase();
  return pm !== 'credit' && pm !== 'on_account' && pm !== 'terms';
}

/**
 * Hard block before writing accountPayments — prevents POS / statement double-recording.
 */
export async function assertAccountPaymentAllowed(
  db: Firestore,
  input: AccountPaymentGuardInput,
): Promise<AccountPaymentGuardResult> {
  const amount = round2(input.amount);
  if (amount <= 0) {
    return { allowed: false, reason: 'Enter a valid amount.' };
  }

  const fingerprintSnap = await getDocs(
    query(
      collection(db, 'accountPayments'),
      where('storeId', '==', input.storeId),
      where('paymentFingerprint', '==', input.fingerprint),
    ),
  );
  if (!fingerprintSnap.empty) {
    return {
      allowed: false,
      reason:
        'This exact payment was already recorded. Refresh the page — do not save again.',
    };
  }

  if (input.accountType !== 'customer' || input.direction !== 'in') {
    return { allowed: true };
  }

  const receiptsSnap = await getDocs(collection(db, 'stores', input.storeId, 'financeReceipts'));
  const nameKey = normalizeName(input.accountName);
  const paymentDate = input.date.slice(0, 10);

  for (const receiptDoc of receiptsSnap.docs) {
    const receipt = receiptDoc.data() as Record<string, unknown>;
    if (receipt.sourceType !== 'order') continue;
    const receiptAmount = round2(Number(receipt.amount) || 0);
    const receiptDate = String(receipt.paymentDate || receipt.date || '').slice(0, 10);
    const receiptName = normalizeName(String(receipt.clientName || ''));
    if (receiptAmount === amount && receiptDate === paymentDate && receiptName === nameKey) {
      const voucher = String(receipt.voucherNumber || receipt.sourceId || receiptDoc.id);
      const ref = String(receipt.notes || receipt.sourceId || '');
      return {
        allowed: false,
        reason:
          `This POS sale is already on Receipts (${voucher}${ref ? ` · ${ref}` : ''}). `
          + 'Account Statement cannot record the same money twice.',
      };
    }
  }

  const orderQueries = [
    query(
      collection(db, 'orders'),
      where('storeId', '==', input.storeId),
      where('customerId', '==', input.accountId),
    ),
    query(
      collection(db, 'orders'),
      where('storeId', '==', input.storeId),
      where('customerName', '==', input.accountName),
    ),
  ];

  const seenOrderIds = new Set<string>();
  const paidCashOrders: Array<{ id: string; total: number; invoiceNumber: string; voucher?: string }> = [];

  for (const orderQuery of orderQueries) {
    const orderSnap = await getDocs(orderQuery);
    for (const orderDoc of orderSnap.docs) {
      if (seenOrderIds.has(orderDoc.id)) continue;
      seenOrderIds.add(orderDoc.id);
      const order = orderDoc.data() as Record<string, unknown>;
      const total = round2(Math.abs(Number(order.total) || 0));
      if (total <= 0) continue;
      const paid = round2(Number(order.amountPaid) || 0);
      const paymentStatus = String(order.paymentStatus || '').toLowerCase();
      const isPaid = paymentStatus === 'paid' || paid >= total;
      if (!isPaid || !isCashSaleMethod(order.paymentMethod)) continue;

      const receipt = receiptsSnap.docs.find((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return data.sourceType === 'order' && data.sourceId === orderDoc.id;
      });
      if (!receipt) continue;

      const receiptData = receipt.data() as Record<string, unknown>;
      paidCashOrders.push({
        id: orderDoc.id,
        total,
        invoiceNumber: String(order.invoiceNumber || orderDoc.id),
        voucher: String(receiptData.voucherNumber || ''),
      });

      if (total === amount) {
        return {
          allowed: false,
          reason:
            `POS order ${paidCashOrders[paidCashOrders.length - 1].invoiceNumber} is already receipted`
            + `${paidCashOrders[paidCashOrders.length - 1].voucher ? ` (${paidCashOrders[paidCashOrders.length - 1].voucher})` : ''}. `
            + 'Payment blocked to prevent duplicate accounting.',
        };
      }
    }
  }

  const openDueSnap = await getDocs(
    query(
      collection(db, 'orders'),
      where('storeId', '==', input.storeId),
      where('customerId', '==', input.accountId),
    ),
  );

  let openBalance = 0;
  for (const orderDoc of openDueSnap.docs) {
    const order = orderDoc.data() as Record<string, unknown>;
    const total = round2(Number(order.total) || 0);
    const paid = round2(Number(order.amountPaid) || 0);
    const due = Math.max(0, round2(total - paid));
    if (due > 0 && !isCashSaleMethod(order.paymentMethod)) {
      openBalance = round2(openBalance + due);
    }
  }

  if (openBalance <= 0 && paidCashOrders.length > 0) {
    return {
      allowed: false,
      reason:
        'This customer has no open credit balance. Recent POS cash sales are already on Receipts — payment blocked.',
    };
  }

  return { allowed: true };
}
