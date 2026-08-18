import { parseBankStatementCsv, type ParsedStatementRow } from '@/lib/ledger/bankRecCsv';
import { netDebitMovementFromStatementLines } from '@/lib/ledger/accountLedgerLines';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ExternalReconciliationImport = {
  accountId: string;
  accountCode: string;
  balance: number;
  fileName: string;
  importedAt: string;
  lines?: ParsedStatementRow[];
  source: 'balance_csv' | 'statement_csv';
};

const STORAGE_PREFIX = 'grabio.reconciliation.external.v1';

function storageKey(storeId: string): string {
  return `${STORAGE_PREFIX}.${storeId}`;
}

export function loadExternalReconciliationImports(storeId: string): Record<string, ExternalReconciliationImport> {
  if (!storeId || typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ExternalReconciliationImport>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveExternalReconciliationImport(
  storeId: string,
  record: ExternalReconciliationImport,
): Record<string, ExternalReconciliationImport> {
  const all = loadExternalReconciliationImports(storeId);
  all[record.accountId] = record;
  localStorage.setItem(storageKey(storeId), JSON.stringify(all));
  return all;
}

export function clearExternalReconciliationImport(
  storeId: string,
  accountId: string,
): Record<string, ExternalReconciliationImport> {
  const all = loadExternalReconciliationImports(storeId);
  delete all[accountId];
  localStorage.setItem(storageKey(storeId), JSON.stringify(all));
  return all;
}

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

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? round2(n) : null;
}

/** Parse external balance CSV: single balance, balance column, or full statement. */
export function parseExternalReconciliationCsv(text: string):
  | { ok: true; balance: number; lines?: ParsedStatementRow[]; source: 'balance_csv' | 'statement_csv'; warnings: string[] }
  | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'CSV is empty.' };

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    const cells = splitCsvLine(lines[0]);
    const amount = parseAmount(cells[cells.length - 1]);
    if (amount !== null) {
      return { ok: true, balance: amount, source: 'balance_csv', warnings: [] };
    }
  }

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const balanceIdx = header.findIndex((h) => h === 'balance' || h === 'closing_balance' || h === 'amount');
  if (balanceIdx >= 0 && lines.length >= 2) {
    const lastRow = splitCsvLine(lines[lines.length - 1]);
    const balance = parseAmount(lastRow[balanceIdx] ?? lastRow[lastRow.length - 1]);
    if (balance !== null) {
      return { ok: true, balance, source: 'balance_csv', warnings: [] };
    }
  }

  const statement = parseBankStatementCsv(text);
  if (!statement.ok) return statement;
  const net = netDebitMovementFromStatementLines(statement.rows);
  return {
    ok: true,
    balance: net,
    lines: statement.rows,
    source: 'statement_csv',
    warnings: statement.warnings,
  };
}

export function externalBalanceMap(
  imports: Record<string, ExternalReconciliationImport>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [accountId, row] of Object.entries(imports)) {
    map[accountId] = round2(row.balance);
  }
  return map;
}
