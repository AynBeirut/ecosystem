export type DiscountType = 'fixed' | 'percent';

export function resolveDiscountAmount(
  subtotal: number,
  type: DiscountType | undefined,
  value: number,
): number {
  if (!value || value <= 0) return 0;
  if (type === 'percent') {
    return Math.round((subtotal * value / 100 + Number.EPSILON) * 100) / 100;
  }
  return value;
}

export function formatDiscountLabel(type: DiscountType, value: number, currency = 'USD'): string {
  if (!value || value <= 0) return '';
  if (type === 'percent') return `${value}%`;
  return `${currency} ${value.toFixed(2)}`;
}

export function resolveDocDiscount(
  subtotal: number,
  doc: { discount?: number; discountType?: string; discountValue?: number },
): { amount: number; label: string } {
  const hasType = doc.discountType === 'fixed' || doc.discountType === 'percent';
  const type: DiscountType = doc.discountType === 'percent' ? 'percent' : 'fixed';
  const value = hasType
    ? Number(doc.discountValue) || 0
    : Number(doc.discount) || 0;
  const amount = hasType
    ? resolveDiscountAmount(subtotal, type, value)
    : Number(doc.discount) || 0;
  const label = hasType ? formatDiscountLabel(type, value) : '';
  return { amount, label };
}
