import type { Purchase } from '@/types/inventory';

const PAY_EPSILON = 0.005;

function parseAmount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

type PurchasePaymentFields = Purchase & {
  paidAmount?: number;
  paid?: number;
};

function sumPaymentHistory(purchase: PurchasePaymentFields): number {
  if (!Array.isArray(purchase.paymentHistory)) return 0;
  return purchase.paymentHistory.reduce((sum, entry) => sum + parseAmount(entry.amount), 0);
}

/** Canonical paid total — POS sync uses `paidAmount`; admin uses `amountPaid` + history. */
export function resolvePurchaseAmountPaid(purchase: PurchasePaymentFields): number {
  const total = resolvePurchaseTotalAmount(purchase);
  const fromFields = parseAmount(
    purchase.amountPaid ?? purchase.paidAmount ?? purchase.paid,
  );
  const fromHistory = sumPaymentHistory(purchase);
  let paid = fromFields > 0 ? fromFields : fromHistory;

  const explicit = String(purchase.paymentStatus || '').toLowerCase();
  if (explicit === 'paid' && total > 0 && paid < total - PAY_EPSILON) {
    paid = total;
  }
  return paid;
}

export function resolvePurchaseTotalAmount(purchase: Purchase): number {
  return (
    parseAmount(purchase.totalAmount)
    || parseAmount(purchase.total)
    || parseAmount(purchase.totalCost)
  );
}

export function resolvePurchasePaymentStatus(purchase: PurchasePaymentFields): 'paid' | 'partial' | 'unpaid' {
  const explicit = purchase.paymentStatus;
  if (explicit === 'paid' || explicit === 'partial' || explicit === 'unpaid') {
    const total = resolvePurchaseTotalAmount(purchase);
    const paid = resolvePurchaseAmountPaid(purchase);
    if (explicit === 'paid' && total > 0 && paid < total - PAY_EPSILON) return 'paid';
    if (explicit === 'unpaid' && paid >= total - PAY_EPSILON && total > 0) return 'paid';
    if (explicit === 'unpaid' && paid > 0) return 'partial';
    return explicit;
  }
  const total = resolvePurchaseTotalAmount(purchase);
  const paid = resolvePurchaseAmountPaid(purchase);
  if (total > 0 && paid >= total - PAY_EPSILON) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export function formatPurchasePaymentStatement(
  purchase: Purchase,
  formatMoney: (amount: number) => string,
): string {
  const total = resolvePurchaseTotalAmount(purchase);
  const paid = resolvePurchaseAmountPaid(purchase);
  const status = resolvePurchasePaymentStatus(purchase);
  if (status === 'paid') return `Paid · ${formatMoney(total)}`;
  if (status === 'partial') return `Partial · paid ${formatMoney(paid)} · due ${formatMoney(total - paid)}`;
  return `Unpaid · due ${formatMoney(total)}`;
}
