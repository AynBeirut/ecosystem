export type InvoiceManagerDatePreset = 'today' | 'month' | 'custom';

export type InvoiceManagerDateRange = {
  start: string;
  end: string;
};

/** Calendar Y-M-D in the user's local timezone (not UTC). */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toYmd(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return localYmd(parsed);
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return localYmd(d);
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localYmd(value);
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') {
      const d = toDate();
      if (!Number.isNaN(d.getTime())) return localYmd(d);
    }
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const sec = Number((value as { seconds?: number }).seconds);
    if (Number.isFinite(sec)) return localYmd(new Date(sec * 1000));
  }
  return null;
}

export function resolveInvoiceManagerDateRange(
  preset: InvoiceManagerDatePreset,
  customStart: string,
  customEnd: string,
): InvoiceManagerDateRange {
  const now = new Date();
  const today = localYmd(now);
  if (preset === 'today') {
    return { start: today, end: today };
  }
  if (preset === 'month') {
    const start = localYmd(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = localYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { start, end };
  }
  const start = customStart?.trim() || today;
  const end = customEnd?.trim() || start;
  return { start, end: end >= start ? end : start };
}

/** Same date precedence as Grabio `fetchFinanceExpenses`. */
export function expenseRecordDate(expense: {
  startDate?: unknown;
  expenseDate?: unknown;
  date?: unknown;
  createdAt?: unknown;
}): unknown {
  const row = expense as Record<string, unknown>;
  return row.startDate ?? row.expenseDate ?? row.date ?? row.createdAt;
}

/** When date is missing on a row (e.g. legacy client), keep visible. */
export function isInInvoiceManagerDateRange(
  value: unknown,
  range: InvoiceManagerDateRange,
  includeWhenMissing = true,
): boolean {
  const ymd = toYmd(value);
  if (!ymd) return includeWhenMissing;
  return ymd >= range.start && ymd <= range.end;
}
