import { accountCodeNumeric, accountsInCodeRange } from '@/lib/ledger/accountCodeRange';
import {
  buildGeneralLedgerRowsFromContext,
  createLedgerReportContext,
} from '@/lib/ledger/ledgerReportContext';
import { splitOpeningByNormalBalance } from '@/lib/ledger/formatLedgerAmount';
import type {
  AccountRangeStatementReport,
  AccountRangeStatementSection,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';

export const ACCOUNT_RANGE_STATEMENT_MAX_ACCOUNTS = 40;

export function countAccountsInStatementRange(
  accounts: LedgerAccount[],
  fromCode: string,
  toCode: string,
): number {
  return accountsInCodeRange(accounts, fromCode, toCode).length;
}

/** Max movement lines rendered on screen (full data still in CSV export). */
export const ACCOUNT_RANGE_STATEMENT_MAX_DISPLAY_ROWS = 200;

export function validateAccountRangeStatement(
  accounts: LedgerAccount[],
  fromCode: string,
  toCode: string,
  dates?: { startDate: string; endDate: string },
): string | null {
  const from = fromCode.trim();
  const to = toCode.trim();
  if (!from || !to) return 'Enter From and To account codes.';
  if (dates) {
    const start = dates.startDate.slice(0, 10);
    const end = dates.endDate.slice(0, 10);
    if (!start || !end) return 'Choose both period dates.';
    if (start > end) return 'Period From must be on or before Period To.';
  }
  const count = countAccountsInStatementRange(accounts, from, to);
  if (count === 0) {
    return `No active accounts in range ${from} → ${to}. Check codes (e.g. 601 → 609, 41110 → 41130).`;
  }
  return null;
}

export function listAccountsInStatementRange(
  accounts: LedgerAccount[],
  fromCode: string,
  toCode: string,
): LedgerAccount[] {
  return accountsInCodeRange(accounts, fromCode, toCode);
}

export function buildAccountRangeStatement(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { fromCode: string; toCode: string; startDate: string; endDate: string },
): AccountRangeStatementReport {
  const validationError = validateAccountRangeStatement(
    accounts,
    options.fromCode,
    options.toCode,
    { startDate: options.startDate, endDate: options.endDate },
  );
  if (validationError) {
    throw new Error(validationError);
  }

  const matched = accountsInCodeRange(accounts, options.fromCode, options.toCode);
  const ctx = createLedgerReportContext(entries, lines, {
    startDate: options.startDate,
    endDate: options.endDate,
  });

  const sections: AccountRangeStatementSection[] = [];
  for (const account of matched) {
    const built = buildGeneralLedgerRowsFromContext(account, ctx, { includeZeroActivity: true });
    if (!built) continue;
    const opening = splitOpeningByNormalBalance(built.openingBalance, account.normalBalance);
    sections.push({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      openingBalance: built.openingBalance,
      openingDebit: opening.debit,
      openingCredit: opening.credit,
      closingBalance: built.closingBalance,
      rows: built.rows,
    });
  }

  const from = options.fromCode.trim();
  const to = options.toCode.trim();
  const [fromCode, toCode] =
    accountCodeNumeric(from) <= accountCodeNumeric(to) ? [from, to] : [to, from];

  return {
    fromCode,
    toCode,
    startDate: options.startDate.slice(0, 10),
    endDate: options.endDate.slice(0, 10),
    accountCount: sections.length,
    sections,
  };
}

export function accountRangeStatementToCsv(report: AccountRangeStatementReport): string {
  const chunks: string[] = [
    `From,${report.fromCode}`,
    `To,${report.toCode}`,
    `Period,${report.startDate},${report.endDate}`,
    '',
  ];
  for (const section of report.sections) {
    chunks.push(`Account,${section.accountCode},${section.accountName.replace(/,/g, ' ')}`);
    chunks.push('Date,Description,Debit,Credit,Balance');
    chunks.push(
      `${report.startDate},B/F,${section.openingDebit || ''},${section.openingCredit || ''},${section.openingBalance}`,
    );
    for (const row of section.rows) {
      const desc = `${row.displayDescription || row.memo || ''} ${row.voucherType || ''} ${row.voucherNumber || row.entryId}`.replace(/,/g, ' ').trim();
      chunks.push([row.date, desc, row.debit || '', row.credit || '', row.runningBalance].join(','));
    }
    chunks.push(`Total,,,${section.closingBalance}`);
    chunks.push('');
  }
  return chunks.join('\n');
}
