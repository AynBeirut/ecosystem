import type { JournalLineInput, JournalEntry, JournalLine, LedgerAccount } from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const FX_GAIN_CODES = ['7751', '766', '769'];
const FX_LOSS_CODES = ['6751', '668', '669'];

export type FxRevalLinePreview = {
  accountId: string;
  accountCode: string;
  accountName: string;
  foreignBalance: number;
  adjustment: number;
};

export type FxRevaluationPreview = {
  asOfDate: string;
  previousRate: number;
  newRate: number;
  mainCurrency: string;
  foreignCurrency: string;
  lines: FxRevalLinePreview[];
  journalLines: JournalLineInput[];
  totalAdjustment: number;
  gainAccountId?: string;
  lossAccountId?: string;
  canPost: boolean;
  blockReason?: string;
};

function findAccount(accounts: LedgerAccount[], codes: string[]): LedgerAccount | undefined {
  for (const code of codes) {
    const hit = accounts.find((a) => a.isActive && a.code === code);
    if (hit) return hit;
  }
  return undefined;
}

function accountBalance(account: LedgerAccount, tbRow?: { debit: number; credit: number }): number {
  if (!tbRow) return 0;
  if (account.type === 'asset' || account.type === 'expense') return round2(tbRow.debit - tbRow.credit);
  return round2(tbRow.credit - tbRow.debit);
}

export function buildFxRevaluationPreview(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  options: {
    asOfDate: string;
    previousRate: number;
    newRate: number;
    mainCurrency?: string;
  },
): FxRevaluationPreview {
  const mainCurrency = (options.mainCurrency || 'USD').toUpperCase();
  const foreignCurrency = mainCurrency === 'USD' ? 'LL' : 'USD';
  const previousRate = options.previousRate;
  const newRate = options.newRate;

  const tb = buildTrialBalance(accounts, entries, lines, { endDate: options.asOfDate });
  const tbMap = new Map(tb.rows.map((r) => [r.accountId, r]));

  const foreignAccounts = accounts.filter(
    (a) =>
      a.isActive &&
      (a.type === 'asset' || a.type === 'liability') &&
      (a.currency === foreignCurrency || a.code.startsWith('102') || a.code.startsWith('103')),
  );

  const gainAcct = findAccount(accounts, FX_GAIN_CODES);
  const lossAcct = findAccount(accounts, FX_LOSS_CODES);

  const previews: FxRevalLinePreview[] = [];
  const journalLines: JournalLineInput[] = [];
  let totalAdjustment = 0;

  for (const account of foreignAccounts) {
    const bal = accountBalance(account, tbMap.get(account.id));
    if (bal === 0) continue;
    const bookFunctional = round2(bal * previousRate);
    const newFunctional = round2(bal * newRate);
    const adjustment = round2(newFunctional - bookFunctional);
    if (adjustment === 0) continue;
    previews.push({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      foreignBalance: bal,
      adjustment,
    });
    totalAdjustment = round2(totalAdjustment + adjustment);
  }

  for (const row of previews) {
    if (row.adjustment > 0) {
      journalLines.push({
        accountId: row.accountId,
        debit: row.adjustment,
        credit: 0,
        description: `FX reval @ ${newRate}`,
      });
    } else {
      journalLines.push({
        accountId: row.accountId,
        debit: 0,
        credit: -row.adjustment,
        description: `FX reval @ ${newRate}`,
      });
    }
  }

  if (totalAdjustment > 0 && gainAcct) {
    journalLines.push({
      accountId: gainAcct.id,
      debit: 0,
      credit: totalAdjustment,
      description: 'FX revaluation gain',
    });
  } else if (totalAdjustment < 0 && lossAcct) {
    journalLines.push({
      accountId: lossAcct.id,
      debit: -totalAdjustment,
      credit: 0,
      description: 'FX revaluation loss',
    });
  }

  const canPost =
    previews.length > 0 &&
    previousRate > 0 &&
    newRate > 0 &&
    previousRate !== newRate &&
    journalLines.length >= 2 &&
    ((totalAdjustment > 0 && Boolean(gainAcct)) || (totalAdjustment < 0 && Boolean(lossAcct)));

  let blockReason: string | undefined;
  if (previousRate <= 0 || newRate <= 0) blockReason = 'Enter valid exchange rates.';
  else if (previousRate === newRate) blockReason = 'Rates are identical — no adjustment.';
  else if (!previews.length) blockReason = `No ${foreignCurrency} balances found to revalue.`;
  else if (totalAdjustment > 0 && !gainAcct) blockReason = 'FX gain account (7751) not in chart.';
  else if (totalAdjustment < 0 && !lossAcct) blockReason = 'FX loss account (6751) not in chart.';

  return {
    asOfDate: options.asOfDate.slice(0, 10),
    previousRate,
    newRate,
    mainCurrency,
    foreignCurrency,
    lines: previews,
    journalLines,
    totalAdjustment,
    gainAccountId: gainAcct?.id,
    lossAccountId: lossAcct?.id,
    canPost,
    blockReason,
  };
}
