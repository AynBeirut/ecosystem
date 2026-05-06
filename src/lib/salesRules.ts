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