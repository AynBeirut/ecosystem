import type {
  IncomeStatementReport,
  IncomeStatementSection,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import { buildLebaneseProfitLossForm } from '@/lib/ledger/lebaneseProfitLoss';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function inDateRange(entryDate: string, start: string, end: string): boolean {
  const d = entryDate.slice(0, 10);
  return d >= start.slice(0, 10) && d <= end.slice(0, 10);
}

function accountHead(code: string): number {
  return parseInt(String(code).split('.')[0], 10);
}

function isPnlPostingAccount(account: LedgerAccount): boolean {
  if (!account.isActive) return false;
  if (account.pcgKind === 'G') return false;
  if (account.type === 'revenue' || account.type === 'expense') return true;
  const head = accountHead(account.code);
  return Number.isFinite(head) && head >= 6000 && head < 8000;
}

function revenueAmount(debit: number, credit: number): number {
  return round2(credit - debit);
}

function expenseAmount(debit: number, credit: number): number {
  return round2(debit - credit);
}

function classifyRevenue(code: string): 'revenue' | 'otherIncome' {
  const head = accountHead(code);
  if (Number.isFinite(head) && head >= 7000 && head < 7200) return 'revenue';
  if (Number.isFinite(head) && head >= 7000 && head < 8000) return 'otherIncome';
  const n = parseInt(code, 10);
  if (!Number.isFinite(n)) return 'otherIncome';
  if (n >= 400 && n < 450) return 'revenue';
  if (n >= 700 && n < 720) return 'revenue';
  return 'otherIncome';
}

function classifyExpense(code: string): 'cogs' | 'operatingExpenses' | 'financialExpenses' {
  const head = accountHead(code);
  if (Number.isFinite(head)) {
    if (head >= 6010 && head < 6200) return 'cogs';
    if (head >= 6600 && head < 6700) return 'financialExpenses';
    if (head >= 6000 && head < 7000) return 'operatingExpenses';
  }
  const n = parseInt(code, 10);
  if (!Number.isFinite(n)) return 'operatingExpenses';
  if (n >= 500 && n < 600) return 'cogs';
  if (n >= 660 && n < 670) return 'financialExpenses';
  if (n >= 700 && n < 720) return 'financialExpenses';
  return 'operatingExpenses';
}

function isRevenueAccount(account: LedgerAccount): boolean {
  if (account.type === 'revenue') return true;
  const head = accountHead(account.code);
  return Number.isFinite(head) && head >= 7000 && head < 8000;
}

function isExpenseAccount(account: LedgerAccount): boolean {
  if (account.type === 'expense') return true;
  const head = accountHead(account.code);
  return Number.isFinite(head) && head >= 6000 && head < 7000;
}

function periodLineSums(
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
): Map<string, { debit: number; credit: number }> {
  const posted = new Set(
    entries
      .filter((e) => e.status === 'posted' && inDateRange(e.date, startDate, endDate))
      .map((e) => e.id),
  );
  const sums = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (!posted.has(line.entryId)) continue;
    const cur = sums.get(line.accountId) || { debit: 0, credit: 0 };
    cur.debit = round2(cur.debit + (line.debit || 0));
    cur.credit = round2(cur.credit + (line.credit || 0));
    sums.set(line.accountId, cur);
  }
  return sums;
}

function buildSection(
  title: string,
  accounts: LedgerAccount[],
  periodSums: Map<string, { debit: number; credit: number }>,
  amountFn: (debit: number, credit: number) => number,
): IncomeStatementSection {
  const rows = accounts
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((a) => {
      const sums = periodSums.get(a.id);
      if (!sums) return null;
      const amount = amountFn(sums.debit, sums.credit);
      if (amount === 0) return null;
      return { accountId: a.id, code: a.code, name: a.name, amount };
    })
    .filter(Boolean) as IncomeStatementSection['rows'];

  const subtotal = round2(rows.reduce((s, r) => s + r.amount, 0));
  return {
    title,
    rows,
    subtotal,
    total: subtotal,
  };
}

export function buildIncomeStatement(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  startDate: string,
  endDate: string,
): IncomeStatementReport {
  const pnlAccounts = accounts.filter(isPnlPostingAccount);
  const periodSums = periodLineSums(entries, lines, startDate, endDate);

  const revenueAccounts = pnlAccounts.filter(
    (a) => isRevenueAccount(a) && classifyRevenue(a.code) === 'revenue',
  );
  const otherIncomeAccounts = pnlAccounts.filter(
    (a) => isRevenueAccount(a) && classifyRevenue(a.code) === 'otherIncome',
  );
  const cogsAccounts = pnlAccounts.filter((a) => isExpenseAccount(a) && classifyExpense(a.code) === 'cogs');
  const operatingAccounts = pnlAccounts.filter(
    (a) => isExpenseAccount(a) && classifyExpense(a.code) === 'operatingExpenses',
  );
  const financialAccounts = pnlAccounts.filter(
    (a) => isExpenseAccount(a) && classifyExpense(a.code) === 'financialExpenses',
  );

  const revenue = buildSection('Revenue', revenueAccounts, periodSums, revenueAmount);
  const otherIncome = buildSection('Other income', otherIncomeAccounts, periodSums, revenueAmount);
  const cogs = buildSection('Cost of goods sold', cogsAccounts, periodSums, expenseAmount);
  const operatingExpenses = buildSection('Operating expenses', operatingAccounts, periodSums, expenseAmount);
  const financialExpenses = buildSection('Financial expenses', financialAccounts, periodSums, expenseAmount);

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
    lebaneseForm: buildLebaneseProfitLossForm(accounts, entries, lines, startDate, endDate),
  };
}

export function incomeStatementToCsv(report: IncomeStatementReport): string {
  const form = report.lebaneseForm;
  const rows: string[][] = [
    ['Profit and Loss', `${report.startDate} to ${report.endDate}`],
    ['Currency', 'LBP'],
    [],
    ['Line', 'Amount'],
    ...form.lines.filter((l) => l.kind !== 'header' || l.label).map((l) => [l.label, l.kind === 'header' ? '' : String(l.amount)]),
    [],
    ['Account detail', '', '', ''],
    ['Section', 'Code', 'Account', 'Amount'],
    ...[report.revenue, report.otherIncome, report.cogs, report.operatingExpenses, report.financialExpenses].flatMap(
      (section) => [
        [section.title],
        ...section.rows.map((r) => [section.title, r.code, r.name, String(r.amount)]),
        ['', '', 'Subtotal', String(section.subtotal)],
        [],
      ],
    ),
    ['Total revenue', '', '', String(report.totalRevenue)],
    ['Gross profit', '', '', String(report.grossProfit)],
    ['Operating income', '', '', String(report.operatingIncome)],
    ['Net income', '', '', String(report.netIncome)],
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
