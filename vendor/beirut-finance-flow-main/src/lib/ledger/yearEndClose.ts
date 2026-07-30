import type { JournalLineInput, JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const RETAINED_EARNINGS_CODES = ['304', '303', '320'];

export type YearEndClosePreview = {
  endDate: string;
  netIncome: number;
  retainedEarningsAccountId: string;
  retainedEarningsCode: string;
  lines: JournalLineInput[];
  revenueAccountsClosed: number;
  expenseAccountsClosed: number;
  canPost: boolean;
  blockReason?: string;
};

function findRetainedEarnings(accounts: LedgerAccount[]): LedgerAccount | undefined {
  for (const code of RETAINED_EARNINGS_CODES) {
    const hit = accounts.find((a) => a.isActive && a.type === 'equity' && a.code === code);
    if (hit) return hit;
  }
  return accounts.find((a) => a.isActive && a.type === 'equity' && !a.code.startsWith('399'));
}

export function buildYearEndClosePreview(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  endDate: string,
): YearEndClosePreview {
  const pnlAccounts = accounts.filter((a) => a.isActive && (a.type === 'revenue' || a.type === 'expense'));
  const tb = buildTrialBalance(pnlAccounts, entries, lines, { endDate });
  const retained = findRetainedEarnings(accounts);

  const closeLines: JournalLineInput[] = [];
  let netIncome = 0;
  let revenueAccountsClosed = 0;
  let expenseAccountsClosed = 0;

  for (const row of tb.rows) {
    const account = accounts.find((a) => a.id === row.accountId);
    if (!account) continue;
    if (account.type === 'revenue') {
      const balance = round2(row.credit - row.debit);
      if (balance === 0) continue;
      closeLines.push({ accountId: account.id, debit: balance, credit: 0, description: 'Year-end close' });
      netIncome = round2(netIncome + balance);
      revenueAccountsClosed += 1;
    } else if (account.type === 'expense') {
      const balance = round2(row.debit - row.credit);
      if (balance === 0) continue;
      closeLines.push({ accountId: account.id, debit: 0, credit: balance, description: 'Year-end close' });
      netIncome = round2(netIncome - balance);
      expenseAccountsClosed += 1;
    }
  }

  if (netIncome !== 0 && retained) {
    if (netIncome > 0) {
      closeLines.push({
        accountId: retained.id,
        debit: 0,
        credit: netIncome,
        description: 'Transfer net income to retained earnings',
      });
    } else {
      closeLines.push({
        accountId: retained.id,
        debit: -netIncome,
        credit: 0,
        description: 'Transfer net loss to retained earnings',
      });
    }
  }

  const canPost = closeLines.length >= 2 && Boolean(retained) && netIncome !== 0;
  let blockReason: string | undefined;
  if (!retained) blockReason = 'Retained earnings account (304/303) not found in chart.';
  else if (closeLines.length < 2) blockReason = 'No revenue or expense balances to close.';
  else if (netIncome === 0) blockReason = 'Net income is zero — nothing to close.';

  return {
    endDate: endDate.slice(0, 10),
    netIncome,
    retainedEarningsAccountId: retained?.id || '',
    retainedEarningsCode: retained?.code || '',
    lines: closeLines,
    revenueAccountsClosed,
    expenseAccountsClosed,
    canPost,
    blockReason,
  };
}
