import type {
  BalanceSheetReport,
  JournalEntry,
  JournalLine,
  LedgerAccount,
} from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function amountForSection(
  accountType: LedgerAccount['type'],
  tb: { debit: number; credit: number },
): number {
  if (accountType === 'asset') return round2(tb.debit - tb.credit);
  return round2(tb.credit - tb.debit);
}

function sectionFromAccounts(
  title: string,
  typeAccounts: LedgerAccount[],
  tbRows: Array<{ accountId: string; accountCode: string; accountName: string; debit: number; credit: number }>,
): { title: string; rows: Array<{ code: string; name: string; amount: number }>; subtotal: number } {
  const tbMap = new Map(tbRows.map((r) => [r.accountId, r]));
  const rows = typeAccounts
    .filter((a) => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => {
      const tb = tbMap.get(a.id);
      if (!tb) return null;
      const amount = amountForSection(a.type, tb);
      if (amount === 0) return null;
      return { code: a.code, name: a.name, amount };
    })
    .filter(Boolean) as Array<{ code: string; name: string; amount: number }>;

  return {
    title,
    rows,
    subtotal: round2(rows.reduce((s, r) => s + r.amount, 0)),
  };
}

export function buildBalanceSheet(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
): BalanceSheetReport {
  const tb = buildTrialBalance(accounts, entries, lines, { endDate: asOfDate });

  const assets = sectionFromAccounts(
    'Assets',
    accounts.filter((a) => a.type === 'asset'),
    tb.rows,
  );
  const liabilities = sectionFromAccounts(
    'Liabilities',
    accounts.filter((a) => a.type === 'liability'),
    tb.rows,
  );
  const equity = sectionFromAccounts(
    'Equity',
    accounts.filter((a) => a.type === 'equity'),
    tb.rows,
  );

  // Include current-period net income in equity (revenue − expense) for BS balance
  const pnlTb = buildTrialBalance(
    accounts.filter((a) => a.type === 'revenue' || a.type === 'expense'),
    entries,
    lines,
    { endDate: asOfDate },
  );
  const revenueTotal = round2(
    pnlTb.rows.filter((r) => r.accountType === 'revenue').reduce((s, r) => s + r.credit, 0),
  );
  const expenseTotal = round2(
    pnlTb.rows.filter((r) => r.accountType === 'expense').reduce((s, r) => s + r.debit, 0),
  );
  const netIncome = round2(revenueTotal - expenseTotal);
  if (netIncome !== 0) {
    equity.rows.push({
      code: '3999',
      name: 'Current Year Earnings',
      amount: netIncome,
    });
    equity.subtotal = round2(equity.subtotal + netIncome);
  }

  const totalAssets = assets.subtotal;
  const totalLiabilitiesAndEquity = round2(liabilities.subtotal + equity.subtotal);

  return {
    asOfDate,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilitiesAndEquity,
    balanced: totalAssets === totalLiabilitiesAndEquity,
  };
}
