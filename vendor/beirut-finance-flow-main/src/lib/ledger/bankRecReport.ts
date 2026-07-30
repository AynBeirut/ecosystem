import type {
  AccountBookLine,
  BankRecMatch,
  BankStatementLine,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import { netDebitMovementFromBookLines, netDebitMovementFromStatementLines } from '@/lib/ledger/accountLedgerLines';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Net debit balance on one account through/before date (posted lines only). */
export function computeBookNetDebitBalance(
  account: LedgerAccount,
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { throughDate?: string; beforeDate?: string },
): number {
  let net = round2(account.openingBalance || 0);
  const posted = entries.filter((e) => e.status === 'posted');
  for (const line of lines) {
    if (line.accountId !== account.id) continue;
    const entry = posted.find((e) => e.id === line.entryId);
    if (!entry) continue;
    const d = entry.date.slice(0, 10);
    if (options.beforeDate && d >= options.beforeDate.slice(0, 10)) continue;
    if (options.throughDate && d > options.throughDate.slice(0, 10)) continue;
    net = round2(net + (Number(line.debit) || 0) - (Number(line.credit) || 0));
  }
  return net;
}

export type BankRecReport = {
  openingBookBalance: number;
  closingBookBalance: number;
  periodBookMovement: number;
  statementOpeningBalance: number;
  closingStatementBalance: number;
  periodStatementMovement: number;
  closingVariance: number;
  matchedPairCount: number;
  matchedStatementNet: number;
  matchedBookNet: number;
  unmatchedStatementNet: number;
  unmatchedBookNet: number;
};

export function buildBankRecReport(params: {
  account: LedgerAccount;
  entries: JournalEntry[];
  lines: JournalLine[];
  startDate: string;
  endDate: string;
  statementOpeningBalance: number;
  bookLines: AccountBookLine[];
  statementLines: BankStatementLine[];
  matches: BankRecMatch[];
}): BankRecReport {
  const { account, entries, lines, startDate, endDate } = params;
  const openingBookBalance = computeBookNetDebitBalance(account, entries, lines, { beforeDate: startDate });
  const closingBookBalance = computeBookNetDebitBalance(account, entries, lines, { throughDate: endDate });
  const periodBookMovement = round2(closingBookBalance - openingBookBalance);
  const periodStatementMovement = netDebitMovementFromStatementLines(params.statementLines);
  const statementOpeningBalance = round2(params.statementOpeningBalance || 0);
  const closingStatementBalance = round2(statementOpeningBalance + periodStatementMovement);
  const closingVariance = round2(closingStatementBalance - closingBookBalance);

  const stmtById = new Map(params.statementLines.map((s) => [s.id, s]));
  const bookById = new Map(params.bookLines.map((b) => [b.lineId, b]));

  let matchedStatementNet = 0;
  let matchedBookNet = 0;
  for (const m of params.matches) {
    const s = stmtById.get(m.statementLineId);
    const b = bookById.get(m.bookLineId);
    if (s) matchedStatementNet = round2(matchedStatementNet + (s.debit - s.credit));
    if (b) matchedBookNet = round2(matchedBookNet + (b.debit - b.credit));
  }

  const matchedStmtIds = new Set(params.matches.map((m) => m.statementLineId));
  const matchedBookIds = new Set(params.matches.map((m) => m.bookLineId));
  const unmatchedStatement = params.statementLines.filter((s) => !matchedStmtIds.has(s.id));
  const unmatchedBook = params.bookLines.filter((b) => !matchedBookIds.has(b.lineId));

  return {
    openingBookBalance,
    closingBookBalance,
    periodBookMovement,
    statementOpeningBalance,
    closingStatementBalance,
    periodStatementMovement,
    closingVariance,
    matchedPairCount: params.matches.length,
    matchedStatementNet,
    matchedBookNet,
    unmatchedStatementNet: netDebitMovementFromStatementLines(unmatchedStatement),
    unmatchedBookNet: netDebitMovementFromBookLines(unmatchedBook),
  };
}
