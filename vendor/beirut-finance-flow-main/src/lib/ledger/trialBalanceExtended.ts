import type {
  JournalEntry,
  JournalLine,
  LedgerAccount,
  TrialBalanceExtendedReport,
  TrialBalanceExtendedRow,
  TrialBalanceViewMode,
} from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';
import { sortLedgerAccountsByCode } from '@/lib/ledger/accountCodeSort';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function sumsForRange(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  start?: string,
  end?: string,
): Map<string, { debit: number; credit: number }> {
  const tb = buildTrialBalance(accounts, entries, lines, { startDate: start, endDate: end });
  const map = new Map<string, { debit: number; credit: number }>();
  for (const row of tb.rows) {
    map.set(row.accountId, { debit: row.debit, credit: row.credit });
  }
  return map;
}

function splitOpeningClosing(
  account: LedgerAccount,
  openingTb: { debit: number; credit: number },
  periodTb: { debit: number; credit: number },
  closingTb: { debit: number; credit: number },
): TrialBalanceExtendedRow {
  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    debit: closingTb.debit,
    credit: closingTb.credit,
    openingDebit: openingTb.debit,
    openingCredit: openingTb.credit,
    periodDebit: periodTb.debit,
    periodCredit: periodTb.credit,
    closingDebit: closingTb.debit,
    closingCredit: closingTb.credit,
  };
}

export function buildExtendedTrialBalance(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { startDate: string; endDate: string; viewMode?: TrialBalanceViewMode },
): TrialBalanceExtendedReport {
  const viewMode = options.viewMode || '4col';
  const endDate = options.endDate;
  const startDate = options.startDate;

  const dayBefore = (() => {
    const d = new Date(startDate.slice(0, 10));
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const openingMap = sumsForRange(accounts, entries, lines, undefined, dayBefore);
  const periodMap = sumsForRange(accounts, entries, lines, startDate, endDate);
  const closingMap = sumsForRange(accounts, entries, lines, undefined, endDate);

  const rows: TrialBalanceExtendedRow[] = [];
  for (const account of sortLedgerAccountsByCode(accounts.filter((a) => a.isActive))) {
    const opening = openingMap.get(account.id) || { debit: 0, credit: 0 };
    const period = periodMap.get(account.id) || { debit: 0, credit: 0 };
    const closing = closingMap.get(account.id) || { debit: 0, credit: 0 };
    if (opening.debit === 0 && opening.credit === 0 && period.debit === 0 && period.credit === 0 && closing.debit === 0 && closing.credit === 0) {
      continue;
    }
    rows.push(splitOpeningClosing(account, opening, period, closing));
  }

  const totalDebits = round2(rows.reduce((s, r) => s + (viewMode === '6col' ? r.closingDebit : r.periodDebit), 0));
  const totalCredits = round2(rows.reduce((s, r) => s + (viewMode === '6col' ? r.closingCredit : r.periodCredit), 0));

  return {
    viewMode,
    rows,
    totalDebits,
    totalCredits,
    balanced: totalDebits === totalCredits,
    startDate: startDate.slice(0, 10),
    endDate: endDate.slice(0, 10),
    asOfDate: endDate.slice(0, 10),
  };
}

export function extendedTrialBalanceToCsv(report: TrialBalanceExtendedReport): string {
  const mode = report.viewMode;
  if (mode === '2col') {
    return ['Code,Account,Debit,Credit', ...report.rows.map((r) => `${r.accountCode},${r.accountName},${r.debit},${r.credit}`)].join('\n');
  }
  if (mode === '6col') {
    const header = 'Code,Account,Open Dr,Open Cr,Period Dr,Period Cr,Close Dr,Close Cr';
    const body = report.rows.map(
      (r) =>
        `${r.accountCode},${r.accountName},${r.openingDebit},${r.openingCredit},${r.periodDebit},${r.periodCredit},${r.closingDebit},${r.closingCredit}`,
    );
    return [header, ...body].join('\n');
  }
  const header = 'Code,Account,Open Dr,Open Cr,Period Dr,Period Cr';
  const body = report.rows.map(
    (r) => `${r.accountCode},${r.accountName},${r.openingDebit},${r.openingCredit},${r.periodDebit},${r.periodCredit}`,
  );
  return [header, ...body].join('\n');
}
