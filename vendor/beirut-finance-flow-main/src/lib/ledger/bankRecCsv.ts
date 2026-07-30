import type { BankStatementLineSource } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ParsedStatementRow = {
  lineDate: string;
  debit: number;
  credit: number;
  description: string;
  reference?: string;
  source: BankStatementLineSource;
};

export type BankRecCsvParseResult =
  | { ok: true; rows: ParsedStatementRow[]; warnings: string[] }
  | { ok: false; error: string };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseDateCell(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

function rowToDebitCredit(
  amount: number,
  side: string | undefined,
): { debit: number; credit: number } {
  const sideNorm = (side || '').trim().toLowerCase();
  if (sideNorm === 'cr' || sideNorm === 'credit' || sideNorm === 'c') {
    return { debit: 0, credit: Math.abs(amount) };
  }
  if (sideNorm === 'dr' || sideNorm === 'debit' || sideNorm === 'd') {
    return { debit: Math.abs(amount), credit: 0 };
  }
  if (amount >= 0) return { debit: amount, credit: 0 };
  return { debit: 0, credit: Math.abs(amount) };
}

/** Parse bank statement CSV: date + amount (+ optional dr/cr) or date + debit + credit. */
export function parseBankStatementCsv(text: string): BankRecCsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { ok: false, error: 'CSV is empty.' };

  const headerCells = splitCsvLine(lines[0]).map(normalizeHeader);
  const hasHeader =
    headerCells.includes('date') ||
    headerCells.includes('transaction_date') ||
    headerCells.includes('amount') ||
    headerCells.includes('debit');

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const headers = hasHeader ? headerCells : ['date', 'amount', 'description', 'ref'];

  const dateIdx = headers.findIndex((h) => h === 'date' || h === 'transaction_date');
  const amountIdx = headers.findIndex((h) => h === 'amount' || h === 'signed_amount');
  const debitIdx = headers.findIndex((h) => h === 'debit');
  const creditIdx = headers.findIndex((h) => h === 'credit');
  const descIdx = headers.findIndex((h) => h === 'description' || h === 'memo' || h === 'narrative');
  const refIdx = headers.findIndex((h) => h === 'ref' || h === 'reference' || h === 'reference_number');
  const sideIdx = headers.findIndex((h) => h === 'dr_cr' || h === 'side' || h === 'type');

  if (dateIdx < 0) return { ok: false, error: 'CSV must include a date column.' };
  if (amountIdx < 0 && (debitIdx < 0 || creditIdx < 0)) {
    return { ok: false, error: 'CSV must include amount or debit/credit columns.' };
  }

  const rows: ParsedStatementRow[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < dataLines.length; i += 1) {
    const cells = splitCsvLine(dataLines[i]);
    const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : '');

    const lineDate = parseDateCell(get(dateIdx));
    if (!lineDate) {
      warnings.push(`Row ${i + (hasHeader ? 2 : 1)}: skipped — invalid date.`);
      continue;
    }

    let debit = 0;
    let credit = 0;
    if (debitIdx >= 0 || creditIdx >= 0) {
      debit = parseAmount(get(debitIdx)) || 0;
      credit = parseAmount(get(creditIdx)) || 0;
    } else {
      const amount = parseAmount(get(amountIdx));
      if (amount === null) {
        warnings.push(`Row ${i + (hasHeader ? 2 : 1)}: skipped — invalid amount.`);
        continue;
      }
      ({ debit, credit } = rowToDebitCredit(amount, get(sideIdx)));
    }

    if (debit === 0 && credit === 0) {
      warnings.push(`Row ${i + (hasHeader ? 2 : 1)}: skipped — zero amount.`);
      continue;
    }

    rows.push({
      lineDate,
      debit: round2(debit),
      credit: round2(credit),
      description: get(descIdx) || 'Statement line',
      reference: get(refIdx) || undefined,
      source: 'csv',
    });
  }

  if (!rows.length) return { ok: false, error: 'No valid rows parsed from CSV.' };
  return { ok: true, rows, warnings };
}
