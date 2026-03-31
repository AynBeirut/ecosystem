export const COUNTED_SALE_STATUSES = ['delivered', 'paid', 'completed'] as const;

export function isCountedSaleStatus(status?: string): boolean {
  if (!status) return false;
  return COUNTED_SALE_STATUSES.includes(status as (typeof COUNTED_SALE_STATUSES)[number]);
}

export function resolveOrderItemProductKey(item: any): string {
  return item?.productId || item?.composedProductId || item?.id || '';
}

export function resolveFinishedGoodsProductKey(finishedGood: any): string {
  return finishedGood?.productId || finishedGood?.composedProductId || '';
}

export function normalizeDateString(input: any): string {
  if (!input) return '';

  if (typeof input === 'string') {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  }

  if (input?.toDate) {
    const parsed = input.toDate();
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

export function isDateInRange(dateInput: any, startDate?: string, endDate?: string): boolean {
  const dateString = normalizeDateString(dateInput);
  if (!dateString) return false;

  const matchesStart = !startDate || dateString >= startDate;
  const matchesEnd = !endDate || dateString <= endDate;

  return matchesStart && matchesEnd;
}