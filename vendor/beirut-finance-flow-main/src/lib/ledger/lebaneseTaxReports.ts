import type { JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type LebaneseTaxReportRow = { accountCode: string; accountName: string; amount: number };

export type R10SalaryWithholdingReport = {
  periodLabel: string;
  wageAccounts: LebaneseTaxReportRow[];
  totalWages: number;
  withholdingPayable: number;
  withholdingAccountCode: string;
};

export type CnssSummaryReport = {
  periodLabel: string;
  employerExpenseAccounts: LebaneseTaxReportRow[];
  totalEmployerShare: number;
  payableAccountCode: string;
  payableBalance: number;
};

const WAGE_CODES = ['631', '6311', '6312', '6313'];
const WITHHOLDING_CODES = ['213', '431', '4311'];
const CNSS_EXPENSE_CODES = ['602', '6021'];
const CNSS_PAYABLE_CODES = ['212', '2121'];

function tbAmountForCodes(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  endDate: string,
  codes: string[],
): LebaneseTaxReportRow[] {
  const tb = buildTrialBalance(accounts, entries, lines, { endDate });
  const codeSet = new Set(codes);
  const rows: LebaneseTaxReportRow[] = [];
  for (const row of tb.rows) {
    if (!codeSet.has(row.accountCode) && !codes.some((c) => row.accountCode.startsWith(c))) continue;
    const acct = accounts.find((a) => a.id === row.accountId);
    const amount =
      acct?.type === 'expense' || acct?.type === 'asset'
        ? round2(row.debit - row.credit)
        : round2(row.credit - row.debit);
    if (amount === 0) continue;
    rows.push({ accountCode: row.accountCode, accountName: row.accountName, amount });
  }
  return rows;
}

function sumRows(rows: LebaneseTaxReportRow[]): number {
  return round2(rows.reduce((s, r) => s + r.amount, 0));
}

export function buildR10SalaryWithholdingReport(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  endDate: string,
): R10SalaryWithholdingReport {
  const wageAccounts = tbAmountForCodes(accounts, entries, lines, endDate, WAGE_CODES);
  const withholdingRows = tbAmountForCodes(accounts, entries, lines, endDate, WITHHOLDING_CODES);
  const periodLabel = endDate.slice(0, 7);
  return {
    periodLabel,
    wageAccounts,
    totalWages: sumRows(wageAccounts),
    withholdingPayable: sumRows(withholdingRows),
    withholdingAccountCode: WITHHOLDING_CODES[0],
  };
}

export function buildCnssSummaryReport(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  endDate: string,
): CnssSummaryReport {
  const employerExpenseAccounts = tbAmountForCodes(accounts, entries, lines, endDate, CNSS_EXPENSE_CODES);
  const payableRows = tbAmountForCodes(accounts, entries, lines, endDate, CNSS_PAYABLE_CODES);
  return {
    periodLabel: endDate.slice(0, 7),
    employerExpenseAccounts,
    totalEmployerShare: sumRows(employerExpenseAccounts),
    payableAccountCode: CNSS_PAYABLE_CODES[0],
    payableBalance: sumRows(payableRows),
  };
}

export function r10ReportToCsv(report: R10SalaryWithholdingReport): string {
  const lines = [
    'R10 Salary Withholding',
    `Period,${report.periodLabel}`,
    'Code,Account,Amount',
    ...report.wageAccounts.map((r) => `${r.accountCode},${r.accountName},${r.amount}`),
    `Total Wages,,${report.totalWages}`,
    `Withholding Payable (${report.withholdingAccountCode}),,${report.withholdingPayable}`,
  ];
  return lines.join('\n');
}

export function cnssReportToCsv(report: CnssSummaryReport): string {
  const lines = [
    'CNSS Summary',
    `Period,${report.periodLabel}`,
    'Code,Account,Amount',
    ...report.employerExpenseAccounts.map((r) => `${r.accountCode},${r.accountName},${r.amount}`),
    `Total Employer Share,,${report.totalEmployerShare}`,
    `Payable (${report.payableAccountCode}),,${report.payableBalance}`,
  ];
  return lines.join('\n');
}
