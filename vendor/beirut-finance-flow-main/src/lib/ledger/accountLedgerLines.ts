import type { AccountBookLine, JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inDateRange(entryDate: string, start: string, end: string): boolean {
  const d = entryDate.slice(0, 10);
  if (d < start.slice(0, 10)) return false;
  if (d > end.slice(0, 10)) return false;
  return true;
}

/** Posted journal lines for one GL account within a period (book side for bank rec). */
export function buildBookLinesForAccount(
  accountId: string,
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { startDate: string; endDate: string },
): AccountBookLine[] {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return [];

  const postedById = new Map<string, JournalEntry>();
  for (const entry of entries) {
    if (entry.status !== 'posted') continue;
    if (!inDateRange(entry.date, options.startDate, options.endDate)) continue;
    postedById.set(entry.id, entry);
  }

  const rows: AccountBookLine[] = [];
  for (const line of lines) {
    if (line.accountId !== accountId) continue;
    const entry = postedById.get(line.entryId);
    if (!entry) continue;
    rows.push({
      lineId: line.id,
      entryId: entry.id,
      entryDate: entry.date.slice(0, 10),
      memo: entry.memo || '',
      voucherNumber: entry.voucherNumber,
      sourceType: entry.sourceType,
      debit: round2(line.debit || 0),
      credit: round2(line.credit || 0),
      description: line.description,
    });
  }

  rows.sort((a, b) => {
    const byDate = a.entryDate.localeCompare(b.entryDate);
    if (byDate !== 0) return byDate;
    return a.entryId.localeCompare(b.entryId);
  });

  return rows;
}

export function netDebitMovementFromBookLines(lines: AccountBookLine[]): number {
  return round2(lines.reduce((s, l) => s + l.debit - l.credit, 0));
}

export function netDebitMovementFromStatementLines(
  lines: Array<{ debit: number; credit: number }>,
): number {
  return round2(lines.reduce((s, l) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0));
}

export function buildBankRecPhase1Summary(
  bookLines: AccountBookLine[],
  statementLines: Array<{ debit: number; credit: number }>,
): {
  bookLineCount: number;
  statementLineCount: number;
  bookNetDebit: number;
  statementNetDebit: number;
  difference: number;
} {
  const bookNetDebit = netDebitMovementFromBookLines(bookLines);
  const statementNetDebit = netDebitMovementFromStatementLines(statementLines);
  return {
    bookLineCount: bookLines.length,
    statementLineCount: statementLines.length,
    bookNetDebit,
    statementNetDebit,
    difference: round2(statementNetDebit - bookNetDebit),
  };
}
