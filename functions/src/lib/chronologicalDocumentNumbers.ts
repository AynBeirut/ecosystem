/** Keep aligned with scripts/lib/chronologicalDocumentNumbers.cjs */

export const DEFAULT_PREFIX: Record<string, string> = {
  PO: 'PO',
  SO: 'SO',
  INV: 'INV',
  EST: 'EST',
  BILL: 'BILL',
  EXP: 'EXP',
  ORD: 'ORD',
  RV: 'RV',
  PV: 'PV',
  JV: 'JV',
  CV: 'CV',
  CRN: 'CRN',
  DRN: 'DRN',
};

const SEQ_PADDING = 6;

export function normalizeDocumentDateKey(input?: string | Date | null): string {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  const s = String(input || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function parseCreatedAtMs(value: unknown): number {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d.getTime();
  }
  if (value && typeof value === 'object' && '_seconds' in value) {
    return Number((value as { _seconds: number })._seconds) * 1000;
  }
  const d = new Date(String(value || ''));
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export type ChronologicalRow = {
  id: string;
  documentDateKey: string;
  createdAtMs: number;
};

function compareRows(a: ChronologicalRow, b: ChronologicalRow): number {
  if (a.documentDateKey !== b.documentDateKey) {
    return a.documentDateKey < b.documentDateKey ? -1 : 1;
  }
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function formatSequentialDocumentNumber(
  kind: string,
  sequence: number,
  prefixOverride?: string,
): string {
  const prefix = (prefixOverride || DEFAULT_PREFIX[kind] || kind).trim() || kind;
  return `${prefix}-${String(sequence).padStart(SEQ_PADDING, '0')}`;
}

export function rebuildChronologicalNumbers(
  rows: ChronologicalRow[],
  kind: string,
  prefixOverride?: string,
): Map<string, string> {
  const sorted = [...rows].sort(compareRows);
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
  if (documentDate) return normalizeDocumentDateKey(documentDate);
  const ms = parseCreatedAtMs(fallbackCreatedAt);
  if (ms > 0) return new Date(ms).toISOString().slice(0, 10);
  return normalizeDocumentDateKey(null);
}
