/** Pure helpers — keep in sync with src/lib/chronologicalDocumentNumbers.ts */

const DEFAULT_PREFIX = {
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

function normalizeDocumentDateKey(input) {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  const s = String(input || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseCreatedAtMs(value) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (value && typeof value === 'object' && value._seconds != null) {
    return value._seconds * 1000;
  }
  const d = new Date(String(value || ''));
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function compareChronologicalRows(a, b) {
  if (a.documentDateKey !== b.documentDateKey) {
    return a.documentDateKey < b.documentDateKey ? -1 : 1;
  }
  if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function formatSequentialDocumentNumber(kind, sequence, prefixOverride) {
  const prefix = (prefixOverride || DEFAULT_PREFIX[kind] || kind).trim() || kind;
  return `${prefix}-${String(sequence).padStart(SEQ_PADDING, '0')}`;
}

function rebuildChronologicalNumbers(rows, kind, prefixOverride) {
  const sorted = [...rows].sort(compareChronologicalRows);
  const out = new Map();
  sorted.forEach((row, index) => {
    out.set(row.id, formatSequentialDocumentNumber(kind, index + 1, prefixOverride));
  });
  return out;
}

function documentDateKeyFromFields(documentDate, fallbackCreatedAt) {
  if (documentDate) return normalizeDocumentDateKey(documentDate);
  const ms = parseCreatedAtMs(fallbackCreatedAt);
  if (ms > 0) return new Date(ms).toISOString().slice(0, 10);
  return normalizeDocumentDateKey(null);
}

module.exports = {
  DEFAULT_PREFIX,
  normalizeDocumentDateKey,
  parseCreatedAtMs,
  compareChronologicalRows,
  formatSequentialDocumentNumber,
  rebuildChronologicalNumbers,
  documentDateKeyFromFields,
};
