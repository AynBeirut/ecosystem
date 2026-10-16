import type { TravelItineraryDay, TravelQuote } from './types';

export function sumQuoteFromDays(days: TravelItineraryDay[]): {
  costTotal: number;
  total: number;
  margin: number;
} {
  let costTotal = 0;
  let total = 0;
  for (const day of days) {
    for (const item of day.items) {
      costTotal += Number(item.cost) || 0;
      total += Number(item.sell) || 0;
    }
  }
  return { costTotal, total, margin: total - costTotal };
}

/** When `days` has items, totals come from line items; otherwise use stored quote totals. */
export function resolveQuoteTotals(
  input: Pick<TravelQuote, 'days' | 'costTotal' | 'total' | 'lines'>,
): { costTotal: number; total: number; margin: number } {
  if (input.days && input.days.length > 0) {
    const hasItems = input.days.some((d) => d.items.length > 0);
    if (hasItems) return sumQuoteFromDays(input.days);
  }
  if (input.lines && input.lines.length > 0) {
    let costTotal = 0;
    let total = 0;
    for (const line of input.lines) {
      costTotal += Number(line.cost) || 0;
      total += Number(line.sell) || 0;
    }
    return { costTotal, total, margin: total - costTotal };
  }
  const costTotal = Number(input.costTotal) || 0;
  const total = Number(input.total) || 0;
  return { costTotal, total, margin: total - costTotal };
}

export function newItineraryId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function quoteHasStructuredDays(days?: TravelItineraryDay[]): boolean {
  return Boolean(days && days.length > 0 && days.some((d) => d.items.length > 0));
}

/** Remove keys whose value is `undefined` (safe for Firestore writes). */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}
