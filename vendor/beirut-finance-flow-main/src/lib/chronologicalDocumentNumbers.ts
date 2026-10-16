/**
 * Assign PREFIX-YYYY-MM-DD-000001 numbers in document-date order (same type).
 * Backdated inserts renumber that date and all later dates for the type.
 */
import {
  type BusinessDocumentKind,
  DEFAULT_PREFIX,
  normalizeDocumentDateKey,
  peekNextDocumentSerial,
} from './documentSerial';

export type ChronologicalRow = {
  id: string;
  documentDateKey: string;
  createdAtMs: number;
};

export function parseCreatedAtMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.getTime();
  }
  const d = new Date(String(value || ''));
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function compareChronologicalRows(a: ChronologicalRow, b: ChronologicalRow): number {
  if (a.documentDateKey !== b.documentDateKey) {
    return a.documentDateKey < b.documentDateKey ? -1 : 1;
  }
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Rebuild display numbers for all rows of one kind (migration + after backdate). */
export function rebuildChronologicalNumbers(
  rows: ChronologicalRow[],
  kind: BusinessDocumentKind,
  prefixOverride?: string,
): Map<string, string> {
  const prefix = (prefixOverride || DEFAULT_PREFIX[kind] || kind).trim() || kind;
  const sorted = [...rows].sort(compareChronologicalRows);
  const byDate = new Map<string, ChronologicalRow[]>();
  for (const row of sorted) {
    const list = byDate.get(row.documentDateKey) || [];
    list.push(row);
    byDate.set(row.documentDateKey, list);
  }
  const out = new Map<string, string>();
  for (const [dateKey, list] of byDate) {
    list.sort(compareChronologicalRows);
    list.forEach((row, index) => {
      const { documentNumber } = peekNextDocumentSerial(
        { [`${kind}-${dateKey}`]: index },
        kind,
        dateKey,
        prefix,
      );
      out.set(row.id, documentNumber);
    });
  }
  return out;
}

export function documentDateKeyFromFields(
  documentDate?: string | Date | null,
  fallbackCreatedAt?: unknown,
): string {
  const fromDoc = normalizeDocumentDateKey(documentDate);
  if (documentDate) return fromDoc;
  const ms = parseCreatedAtMs(fallbackCreatedAt);
  if (ms > 0) return new Date(ms).toISOString().slice(0, 10);
  return fromDoc;
}
