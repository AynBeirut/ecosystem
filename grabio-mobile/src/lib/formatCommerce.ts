/** Safe display helpers — Firestore may return strings or missing numbers. */

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function formatPrice(value: unknown, currency = 'USD'): string {
  const n = toNumber(value);
  if (n == null) return `${currency} —`;
  return `${currency} ${n.toFixed(2)}`;
}

export function formatRating(value: unknown): string | null {
  const n = toNumber(value);
  if (n == null || n <= 0) return null;
  return n.toFixed(1);
}
