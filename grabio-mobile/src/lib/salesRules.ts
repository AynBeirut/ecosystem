export const COUNTED_SALE_STATUSES = ['delivered', 'paid', 'completed'] as const;

export function isCountedSaleStatus(status?: string): boolean {
  if (!status) return false;
  return COUNTED_SALE_STATUSES.includes(status as (typeof COUNTED_SALE_STATUSES)[number]);
}
