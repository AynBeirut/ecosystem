import type {
  CashFlowLineItem,
  CashFlowStatementReport,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const CASH_ACCOUNT_CODES = ['101', '102', '103', '105', '106', '108'] as const;

/** Working-capital and tax clearing accounts for indirect method adjustments. */
export const WC_ACCOUNT_CODES = ['110', '120', '121', '140', '201', '220', '222'] as const;

function inDateRange(entryDate: string, start: string, end: string): boolean {
  const d = entryDate.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function priorDay(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function closingBalance(
  account: LedgerAccount,
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
): number {
  const tb = buildTrialBalance([account], entries, lines, { endDate: asOfDate });
  const row = tb.rows.find((r) => r.accountId === account.id);
  if (!row) return 0;
  if (account.type === 'asset') return round2(row.debit - row.credit);
  if (account.type === 'liability' || account.type === 'equity') return round2(row.credit - row.debit);
  if (account.type === 'revenue') return round2(row.credit - row.debit);
  return round2(row.debit - row.credit);
}

function periodNetIncome(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
): number {
  const posted = new Set(
    entries
      .filter((e) => e.status === 'posted' && inDateRange(e.date, startDate, endDate))
      .map((e) => e.id),
  );
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  let revenue = 0;
  let expense = 0;
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const acct = acctById.get(line.accountId);
    if (!acct || !acct.isActive) continue;
    if (acct.type === 'revenue') revenue = round2(revenue + (line.credit || 0) - (line.debit || 0));
    if (acct.type === 'expense') expense = round2(expense + (line.debit || 0) - (line.credit || 0));
  }
  return round2(revenue - expense);
}

function wcCashEffect(account: LedgerAccount, startBal: number, endBal: number): number {
  const change = round2(endBal - startBal);
  if (account.type === 'asset') return round2(-change);
  if (account.type === 'liability') return round2(change);
  return 0;
}

function isFixedAssetAccount(code: string): boolean {
  return /^15\d/.test(code);
}

function isFinancingAccount(account: LedgerAccount): boolean {
  if (account.type === 'equity') return account.code !== '3999';
  if (account.type === 'liability') {
    const code = account.code;
    if (WC_ACCOUNT_CODES.includes(code as (typeof WC_ACCOUNT_CODES)[number])) return false;
    return code.startsWith('2');
  }
  return false;
}

/**
 * Indirect-method cash flow for a calendar period.
 * Reconciles operating + investing + financing to change in cash accounts (102/106/103…).
 */
export function buildCashFlowStatement(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options: { startDate: string; endDate: string; currency?: string },
): CashFlowStatementReport {
  const startDate = options.startDate.slice(0, 10);
  const endDate = options.endDate.slice(0, 10);
  const currency = options.currency || 'USD';
  const balanceAsOfStart = priorDay(startDate);

  const netIncome = periodNetIncome(accounts, entries, lines, startDate, endDate);
  const operatingLines: CashFlowLineItem[] = [{ label: 'Net income (period)', amount: netIncome, section: 'operating' }];

  let wcTotal = 0;
  for (const code of WC_ACCOUNT_CODES) {
    const acct = accounts.find((a) => a.isActive && a.code === code);
    if (!acct) continue;
    const startBal = closingBalance(acct, entries, lines, balanceAsOfStart);
    const endBal = closingBalance(acct, entries, lines, endDate);
    const effect = wcCashEffect(acct, startBal, endBal);
    if (effect === 0 && startBal === endBal) continue;
    wcTotal = round2(wcTotal + effect);
    operatingLines.push({
      label: `Change in ${acct.code} ${acct.name}`,
      amount: effect,
      section: 'operating',
      accountCode: acct.code,
    });
  }

  const netCashOperating = round2(netIncome + wcTotal);

  let investingTotal = 0;
  const investingLines: CashFlowLineItem[] = [];
  for (const acct of accounts.filter((a) => a.isActive && isFixedAssetAccount(a.code))) {
    const startBal = closingBalance(acct, entries, lines, balanceAsOfStart);
    const endBal = closingBalance(acct, entries, lines, endDate);
    const change = round2(endBal - startBal);
    if (change === 0) continue;
    const effect = round2(-change);
    investingTotal = round2(investingTotal + effect);
    investingLines.push({
      label: `Change in ${acct.code} ${acct.name}`,
      amount: effect,
      section: 'investing',
      accountCode: acct.code,
    });
  }

  let financingTotal = 0;
  const financingLines: CashFlowLineItem[] = [];
  for (const acct of accounts.filter((a) => a.isActive && isFinancingAccount(a))) {
    const startBal = closingBalance(acct, entries, lines, balanceAsOfStart);
    const endBal = closingBalance(acct, entries, lines, endDate);
    let effect = 0;
    if (acct.type === 'equity') effect = round2(endBal - startBal);
    else effect = round2(endBal - startBal);
    if (effect === 0) continue;
    financingTotal = round2(financingTotal + effect);
    financingLines.push({
      label: `Change in ${acct.code} ${acct.name}`,
      amount: effect,
      section: 'financing',
      accountCode: acct.code,
    });
  }

  const netCashInvesting = investingTotal;
  const netCashFinancing = financingTotal;
  const netChangeInCash = round2(netCashOperating + netCashInvesting + netCashFinancing);

  let cashStart = 0;
  let cashEnd = 0;
  const cashBreakdown: CashFlowLineItem[] = [];
  for (const code of CASH_ACCOUNT_CODES) {
    const acct = accounts.find((a) => a.isActive && a.code === code);
    if (!acct) continue;
    const startBal = closingBalance(acct, entries, lines, balanceAsOfStart);
    const endBal = closingBalance(acct, entries, lines, endDate);
    cashStart = round2(cashStart + startBal);
    cashEnd = round2(cashEnd + endBal);
    const delta = round2(endBal - startBal);
    if (startBal !== 0 || endBal !== 0 || delta !== 0) {
      cashBreakdown.push({
        label: `${acct.code} ${acct.name}`,
        amount: delta,
        section: 'reconciliation',
        accountCode: acct.code,
      });
    }
  }

  const cashDeltaFromAccounts = round2(cashEnd - cashStart);
  const reconciliationVariance = round2(netChangeInCash - cashDeltaFromAccounts);

  return {
    startDate,
    endDate,
    currency,
    method: 'indirect',
    netIncome,
    workingCapitalAdjustments: wcTotal,
    netCashFromOperating: netCashOperating,
    netCashFromInvesting: netCashInvesting,
    netCashFromFinancing: netCashFinancing,
    netChangeInCash,
    cashAtBeginning: cashStart,
    cashAtEnd: cashEnd,
    cashDeltaFromAccounts,
    reconciliationVariance,
    reconciled: reconciliationVariance === 0,
    operatingLines,
    investingLines,
    financingLines,
    cashBreakdown,
  };
}

export function cashFlowStatementToCsv(report: CashFlowStatementReport): string {
  const rows: string[][] = [
    ['Cash Flow Statement (indirect)', `${report.startDate} to ${report.endDate}`],
    ['Currency', report.currency],
    [],
    ['Operating activities'],
    ...report.operatingLines.map((l) => [l.label, String(l.amount)]),
    ['Net cash from operating', String(report.netCashFromOperating)],
    [],
    ['Investing activities'],
    ...(report.investingLines.length
      ? report.investingLines.map((l) => [l.label, String(l.amount)])
      : [['(none)', '0']]),
    ['Net cash from investing', String(report.netCashFromInvesting)],
    [],
    ['Financing activities'],
    ...(report.financingLines.length
      ? report.financingLines.map((l) => [l.label, String(l.amount)])
      : [['(none)', '0']]),
    ['Net cash from financing', String(report.netCashFromFinancing)],
    [],
    ['Net change in cash (computed)', String(report.netChangeInCash)],
    ['Cash at beginning', String(report.cashAtBeginning)],
    ['Cash at end', String(report.cashAtEnd)],
    ['Cash change (GL cash accounts)', String(report.cashDeltaFromAccounts)],
    ['Reconciliation variance', String(report.reconciliationVariance)],
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
