import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  TrialBalanceReport,
  TrialBalanceRow,
} from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inDateRange(entryDate: string, start?: string, end?: string): boolean {
  const d = entryDate.slice(0, 10);
  if (start && d < start.slice(0, 10)) return false;
  if (end && d > end.slice(0, 10)) return false;
  return true;
}

function trialBalanceForAccount(
  account: LedgerAccount,
  debitSum: number,
  creditSum: number,
): { debit: number; credit: number } {
  const opening = round2(account.openingBalance || 0);
  let d = debitSum;
  let c = creditSum;

  if (opening !== 0) {
    if (account.normalBalance === 'debit') d += opening;
    else c += opening;
  }

  if (account.normalBalance === 'debit') {
    const balance = round2(d - c);
    return balance >= 0 ? { debit: balance, credit: 0 } : { debit: 0, credit: -balance };
  }
  const balance = round2(c - d);
  return balance >= 0 ? { debit: 0, credit: balance } : { debit: -balance, credit: 0 };
}

export function buildTrialBalance(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options?: { startDate?: string; endDate?: string },
): TrialBalanceReport {
  const postedEntryIds = new Set(
    entries
      .filter((e) => e.status === 'posted' && inDateRange(e.date, options?.startDate, options?.endDate))
      .map((e) => e.id),
  );

  const sums = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (!postedEntryIds.has(line.entryId)) continue;
    const cur = sums.get(line.accountId) || { debit: 0, credit: 0 };
    cur.debit = round2(cur.debit + (line.debit || 0));
    cur.credit = round2(cur.credit + (line.credit || 0));
    sums.set(line.accountId, cur);
  }

  const rows: TrialBalanceRow[] = [];
  for (const account of accounts.filter((a) => a.isActive).sort((a, b) => a.code.localeCompare(b.code))) {
    const sum = sums.get(account.id) || { debit: 0, credit: 0 };
    const tb = trialBalanceForAccount(account, sum.debit, sum.credit);
    if (tb.debit === 0 && tb.credit === 0) continue;
    rows.push({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      debit: tb.debit,
      credit: tb.credit,
    });
  }

  const totalDebits = round2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredits = round2(rows.reduce((s, r) => s + r.credit, 0));

  return {
    rows,
    totalDebits,
    totalCredits,
    balanced: totalDebits === totalCredits,
    asOfDate: options?.endDate,
  };
}
