export function formatMoney(amount: number, currency = 'USD'): string {
  const n = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `${currency} ${n.toFixed(2)}`;
}

export function calcLineSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function calcDocumentTotal(items: Array<{ subtotal: number }>, tax = 0, discount = 0): number {
  const sub = items.reduce((s, i) => s + i.subtotal, 0);
  return Math.round((sub + tax - discount + Number.EPSILON) * 100) / 100;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
