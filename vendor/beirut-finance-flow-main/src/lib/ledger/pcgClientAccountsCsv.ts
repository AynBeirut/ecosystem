import type { PcgClientAccount } from '@/types/generalLedger';
import { mapGrabioCodeToPcg } from '@/lib/ledger/grabioToPcgMap';

const HEADER = 'ClientCode,Name,ArabicName,Currency,GrabioCode,ParentPcgCode';

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function pcgClientAccountsToCsv(rows: PcgClientAccount[]): string {
  const lines = [HEADER];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.clientCode),
        escapeCsv(row.name || ''),
        escapeCsv(row.nameAr || ''),
        escapeCsv(row.currency),
        escapeCsv(row.grabioOperationalCode),
        escapeCsv(row.parentPcgCode || ''),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export type PcgClientAccountCsvRow = {
  clientCode: string;
  grabioOperationalCode: string;
  parentPcgCode?: string;
  name?: string;
  nameAr?: string;
  currency: 'LL' | 'USD';
};

export function parsePcgClientAccountsCsv(text: string): PcgClientAccountCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const startIdx = lines[0].toLowerCase().includes('clientcode') ? 1 : 0;
  const rows: PcgClientAccountCsvRow[] = [];

  for (let i = startIdx; i < lines.length; i += 1) {
    if (lines[i].startsWith('#')) continue;
    const parts = parseCsvLine(lines[i]);
    if (parts.length < 2) continue;
    const clientCode = parts[0]?.trim();
    const grabioOperationalCode = (parts[4] || parts[1] || '').trim();
    if (!clientCode || !grabioOperationalCode) continue;

    const currencyRaw = (parts[3] || 'LL').trim().toUpperCase();
    rows.push({
      clientCode,
      name: parts[1]?.trim() || undefined,
      nameAr: parts[2]?.trim() || undefined,
      currency: currencyRaw === 'USD' ? 'USD' : 'LL',
      grabioOperationalCode,
      parentPcgCode: parts[5]?.trim() || mapGrabioCodeToPcg(grabioOperationalCode),
    });
  }

  return rows;
}

export function pcgClientAccountsTemplateCsv(
  accounts: Array<{ code: string; name: string; nameAr?: string }>,
): string {
  const lines = [HEADER, '# Fill ClientCode with your ERP codes; keep GrabioCode as-is'];
  for (const account of accounts) {
    const parent = mapGrabioCodeToPcg(account.code) || '';
    lines.push(
      [
        escapeCsv(''),
        escapeCsv(account.name),
        escapeCsv(account.nameAr || ''),
        escapeCsv('LL'),
        escapeCsv(account.code),
        escapeCsv(parent),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function validateClientPcgCode(code: string): string | null {
  const trimmed = String(code || '').trim();
  if (!trimmed) return 'Client code is required';
  if (!/^[\d.]{4,11}$/.test(trimmed)) return 'Client code must be 4–11 digits (dots allowed)';
  return null;
}
