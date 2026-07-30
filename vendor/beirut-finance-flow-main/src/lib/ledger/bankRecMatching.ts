import type { AccountBookLine, BankStatementLine } from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Signed movement on debit-normal bank accounts (Dr − Cr). */
export function lineNetDebit(line: { debit: number; credit: number }): number {
  return round2((Number(line.debit) || 0) - (Number(line.credit) || 0));
}

export type BankRecMatchRecord = {
  id: string;
  statementLineId: string;
  bookLineId: string;
  matchType: 'manual' | 'auto';
};

export type AutoMatchOptions = {
  /** Calendar days ± around statement line date (default 3). */
  dateWindowDays?: number;
};

function daysBetween(a: string, b: string): number {
  const ta = new Date(a.slice(0, 10)).getTime();
  const tb = new Date(b.slice(0, 10)).getTime();
  return Math.abs(Math.round((ta - tb) / (1000 * 60 * 60 * 24)));
}

/** Greedy 1:1 auto-match by exact net amount and date window. */
export function suggestAutoMatches(
  statementLines: BankStatementLine[],
  bookLines: AccountBookLine[],
  existingMatches: BankRecMatchRecord[],
  options?: AutoMatchOptions,
): Array<{ statementLineId: string; bookLineId: string }> {
  const window = options?.dateWindowDays ?? 3;
  const matchedStmt = new Set(existingMatches.map((m) => m.statementLineId));
  const matchedBook = new Set(existingMatches.map((m) => m.bookLineId));

  const suggestions: Array<{ statementLineId: string; bookLineId: string }> = [];

  const stmSorted = [...statementLines].sort((a, b) => a.lineDate.localeCompare(b.lineDate));
  for (const stmt of stmSorted) {
    if (matchedStmt.has(stmt.id)) continue;
    const stmtNet = lineNetDebit(stmt);
    if (stmtNet === 0) continue;

    const candidate = bookLines.find((book) => {
      if (matchedBook.has(book.lineId)) return false;
      if (lineNetDebit(book) !== stmtNet) return false;
      return daysBetween(stmt.lineDate, book.entryDate) <= window;
    });

    if (candidate) {
      suggestions.push({ statementLineId: stmt.id, bookLineId: candidate.lineId });
      matchedStmt.add(stmt.id);
      matchedBook.add(candidate.lineId);
    }
  }

  return suggestions;
}

export function partitionUnmatched(
  statementLines: BankStatementLine[],
  bookLines: AccountBookLine[],
  matches: BankRecMatchRecord[],
): {
  unmatchedStatement: BankStatementLine[];
  unmatchedBook: AccountBookLine[];
  matchedPairs: Array<{ statement: BankStatementLine; book: AccountBookLine; match: BankRecMatchRecord }>;
} {
  const bookById = new Map(bookLines.map((b) => [b.lineId, b]));
  const stmtById = new Map(statementLines.map((s) => [s.id, s]));
  const matchedStmt = new Set<string>();
  const matchedBook = new Set<string>();
  const matchedPairs: Array<{ statement: BankStatementLine; book: AccountBookLine; match: BankRecMatchRecord }> = [];

  for (const match of matches) {
    const statement = stmtById.get(match.statementLineId);
    const book = bookById.get(match.bookLineId);
    if (!statement || !book) continue;
    matchedPairs.push({ statement, book, match });
    matchedStmt.add(match.statementLineId);
    matchedBook.add(match.bookLineId);
  }

  return {
    unmatchedStatement: statementLines.filter((s) => !matchedStmt.has(s.id)),
    unmatchedBook: bookLines.filter((b) => !matchedBook.has(b.lineId)),
    matchedPairs,
  };
}
