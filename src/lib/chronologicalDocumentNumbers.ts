/**
 * Assign PREFIX-000001 numbers in document-date order (one global sequence per type; date not shown).
 * Backdated inserts renumber the full store sequence for that type.
 */
import {
  type BusinessDocumentKind,
  formatSequentialDocumentNumber,
  normalizeDocumentDateKey,
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
  const sorted = [...rows].sort(compareChronologicalRows);
  const out = new Map<string, string>();
  sorted.forEach((row, index) => {
    out.set(row.id, formatSequentialDocumentNumber(kind, index + 1, prefixOverride));
  });
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
