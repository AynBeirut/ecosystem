export const COUNTED_SALE_STATUSES = ['delivered', 'paid', 'completed'] as const;

type OrderItemLike = {
  productId?: string;
  composedProductId?: string;
  id?: string;
};

type FinishedGoodLike = {
  productId?: string;
  composedProductId?: string;
};

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

export function isCountedSaleStatus(status?: string): boolean {
  if (!status) return false;
  return COUNTED_SALE_STATUSES.includes(status as (typeof COUNTED_SALE_STATUSES)[number]);
}

export type CountedSaleRevenueOrderLike = {
  status?: string;
  total?: unknown;
};

/** Gross sales revenue: counted statuses only, non-negative finite totals (matches dashboard). */
export function getOrderEffectiveAmountPaid(order: {
  amountPaid?: unknown;
  paymentStatus?: string;
  total?: unknown;
}): number {
  const total = typeof order.total === 'number' ? order.total : Number(order.total || 0);
  const recorded = typeof order.amountPaid === 'number' ? order.amountPaid : Number(order.amountPaid || 0);
  const ps = String(order.paymentStatus || '').toLowerCase();
  if ((ps === 'paid' || ps === 'completed') && Number.isFinite(total) && total > 0) {
    if (Number.isFinite(recorded) && recorded >= total - 0.01) {
      return Math.round(recorded * 100) / 100;
    }
    return Math.round(total * 100) / 100;
  }
  if (Number.isFinite(recorded) && recorded > 0) {
    return Math.round(recorded * 100) / 100;
  }
  return 0;
}

export function getOrderAmountDue(order: {
  amountPaid?: unknown;
  paymentStatus?: string;
  total?: unknown;
}): number {
  const total = typeof order.total === 'number' ? order.total : Number(order.total || 0);
  const paid = getOrderEffectiveAmountPaid(order);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export function normalizeOrderPaymentStatus(order: {
  paymentStatus?: string;
  amountPaid?: unknown;
  total?: unknown;
}): 'paid' | 'partial' | 'unpaid' | 'refunded' {
  const rawStatus = String(order.paymentStatus || '').toLowerCase();
  if (rawStatus === 'paid' || rawStatus === 'completed') return 'paid';
  if (rawStatus === 'partial') return 'partial';
  if (rawStatus === 'refunded') return 'refunded';
  if (rawStatus === 'failed') return 'unpaid';

  const total = Number(order.total || 0);
  const paid = getOrderEffectiveAmountPaid(order);
  if (Number.isFinite(total) && total > 0) {
    if (paid >= total - 0.01) return 'paid';
    if (paid > 0) return 'partial';
  }
  return 'unpaid';
}

export function sumCountedSaleOrderRevenue(orders: CountedSaleRevenueOrderLike[]): {
  revenue: number;
  countedOrders: number;
  excludedNonSaleStatus: number;
  excludedInvalidOrNegativeTotal: number;
} {
  let revenue = 0;
  let countedOrders = 0;
  let excludedNonSaleStatus = 0;
  let excludedInvalidOrNegativeTotal = 0;

  for (const order of orders) {
    if (!isCountedSaleStatus(order.status)) {
      excludedNonSaleStatus += 1;
      continue;
    }
    const orderTotal = typeof order.total === 'number' ? order.total : Number(order.total);
    if (!Number.isFinite(orderTotal) || orderTotal < 0) {
      excludedInvalidOrNegativeTotal += 1;
      continue;
    }
    revenue += orderTotal;
    countedOrders += 1;
  }

  return {
    revenue: Math.round((revenue + Number.EPSILON) * 100) / 100,
    countedOrders,
    excludedNonSaleStatus,
    excludedInvalidOrNegativeTotal,
  };
}

/** Cash-on-delivery: unpaid cash order — cash sits with courier until wallet settlement. */
export function isPlatformOrderCod(order: {
  paymentMethod?: string;
  paymentStatus?: string;
  amountPaid?: number;
  total?: number;
}): boolean {
  const pm = (order.paymentMethod || 'cash').toLowerCase();
  const isCashMethod = pm === 'cash' || pm === 'cod' || pm === 'cash_on_delivery';
  if (!isCashMethod) return false;
  const paid = Math.round((Number(order.amountPaid) || 0) * 100) / 100;
  const total = Math.round((Number(order.total) || 0) * 100) / 100;
  const ps = (order.paymentStatus || 'unpaid').toLowerCase();
  return ps !== 'paid' && paid < total;
}

export function resolveOrderItemProductKey(item: OrderItemLike | null | undefined): string {
  return item?.productId || item?.composedProductId || item?.id || '';
}

export function resolveFinishedGoodsProductKey(finishedGood: FinishedGoodLike | null | undefined): string {
  return finishedGood?.productId || finishedGood?.composedProductId || '';
}

export function normalizeDateString(input: string | number | Date | FirestoreTimestampLike | null | undefined): string {
  if (!input) return '';

  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  }

  if (typeof (input as FirestoreTimestampLike)?.toDate === 'function') {
    const parsed = (input as FirestoreTimestampLike).toDate!();
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return '';
}

export function isDateInRange(
  dateInput: string | number | Date | FirestoreTimestampLike | null | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  const dateString = normalizeDateString(dateInput);
  if (!dateString) return false;

  const matchesStart = !startDate || dateString >= startDate;
  const matchesEnd = !endDate || dateString <= endDate;

  return matchesStart && matchesEnd;
}