import type {
  IncomeStatementReport,
  IncomeStatementSection,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function revenueAmount(debit: number, credit: number): number {
  return round2(credit - debit);
}

function expenseAmount(debit: number, credit: number): number {
  return round2(debit - credit);
}

function classifyRevenue(code: string): 'revenue' | 'otherIncome' {
  const n = parseInt(code, 10);
  if (Number.isFinite(n) && n >= 700 && n < 720) return 'revenue';
  return 'otherIncome';
}

function classifyExpense(code: string): 'cogs' | 'operatingExpenses' | 'financialExpenses' {
  const n = parseInt(code, 10);
  if (Number.isFinite(n)) {
    if (n >= 600 && n < 620) return 'cogs';
    if (n >= 660 && n < 670) return 'financialExpenses';
  }
  return 'operatingExpenses';
}

function buildSection(
  title: string,
  accounts: LedgerAccount[],
  tbRows: Array<{ accountId: string; accountCode: string; accountName: string; debit: number; credit: number }>,
  amountFn: (debit: number, credit: number) => number,
): IncomeStatementSection {
  const tbMap = new Map(tbRows.map((r) => [r.accountId, r]));
  const rows = accounts
    .filter((a) => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((a) => {
      const tb = tbMap.get(a.id);
      if (!tb) return null;
      const amount = amountFn(tb.debit, tb.credit);
      if (amount === 0) return null;
      return { accountId: a.id, code: a.code, name: a.name, amount };
    })
    .filter(Boolean) as IncomeStatementSection['rows'];

  return {
    title,
    rows,
    subtotal: round2(rows.reduce((s, r) => s + r.amount, 0)),
  };
}

export function buildIncomeStatement(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
): IncomeStatementReport {
  const pnlAccounts = accounts.filter((a) => a.type === 'revenue' || a.type === 'expense');
  const tb = buildTrialBalance(pnlAccounts, entries, lines, { startDate, endDate });

  const revenueAccounts = pnlAccounts.filter((a) => a.type === 'revenue' && classifyRevenue(a.code) === 'revenue');
  const otherIncomeAccounts = pnlAccounts.filter((a) => a.type === 'revenue' && classifyRevenue(a.code) === 'otherIncome');
  const cogsAccounts = pnlAccounts.filter((a) => a.type === 'expense' && classifyExpense(a.code) === 'cogs');
  const operatingAccounts = pnlAccounts.filter(
    (a) => a.type === 'expense' && classifyExpense(a.code) === 'operatingExpenses',
  );
  const financialAccounts = pnlAccounts.filter(
    (a) => a.type === 'expense' && classifyExpense(a.code) === 'financialExpenses',
  );

  const revenue = buildSection('Revenue', revenueAccounts, tb.rows, revenueAmount);
  const otherIncome = buildSection('Other income', otherIncomeAccounts, tb.rows, revenueAmount);
  const cogs = buildSection('Cost of goods sold', cogsAccounts, tb.rows, expenseAmount);
  const operatingExpenses = buildSection('Operating expenses', operatingAccounts, tb.rows, expenseAmount);
  const financialExpenses = buildSection('Financial expenses', financialAccounts, tb.rows, expenseAmount);

  const totalRevenue = round2(revenue.subtotal + otherIncome.subtotal);
  const totalExpenses = round2(cogs.subtotal + operatingExpenses.subtotal + financialExpenses.subtotal);
  const grossProfit = round2(totalRevenue - cogs.subtotal);
  const operatingIncome = round2(grossProfit - operatingExpenses.subtotal);
  const netIncome = round2(totalRevenue - totalExpenses);

  return {
    startDate: startDate.slice(0, 10),
    endDate: endDate.slice(0, 10),
    revenue,
    otherIncome,
    cogs,
    operatingExpenses,
    financialExpenses,
    totalRevenue,
    totalExpenses,
    grossProfit,
    operatingIncome,
    netIncome,
  };
}

export function incomeStatementToCsv(report: IncomeStatementReport): string {
  const sections = [
    report.revenue,
    report.otherIncome,
    report.cogs,
    report.operatingExpenses,
    report.financialExpenses,
  ];
  const rows: string[][] = [
    ['Income Statement', `${report.startDate} to ${report.endDate}`],
    [],
    ['Section', 'Code', 'Account', 'Amount'],
    ...sections.flatMap((section) => [
      [section.title],
      ...section.rows.map((r) => [section.title, r.code, r.name, String(r.amount)]),
      ['', '', 'Subtotal', String(section.subtotal)],
      [],
    ]),
    ['Gross profit', '', '', String(report.grossProfit)],
    ['Operating income', '', '', String(report.operatingIncome)],
    ['Net income', '', '', String(report.netIncome)],
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
