import type { LedgerAccount, JournalEntry, JournalLine, TrialBalanceReport } from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';

export interface ReconciliationRow {
  label: string;
  glAmount: number;
  subledgerAmount: number;
  variance: number;
  matched: boolean;
}

export interface ReconciliationReport {
  asOfDate: string;
  rows: ReconciliationRow[];
  allMatched: boolean;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const INTERNATIONAL_GL_CODES = {
  cash: ['102'],
  bank: ['106', '105'],
  ar: ['110'],
  ap: ['201'],
} as const;

export const LEBANESE_PCG_GL_CODES = {
  cash: ['5300'],
  bank: ['5121', '5122', '5110'],
  ar: ['4111', '4110'],
  ap: ['4011'],
} as const;

export function tbBalanceForCodes(tb: TrialBalanceReport, codes: string[]): number {
  const codeSet = new Set(codes);
  return round2(
    tb.rows
      .filter((r) => codeSet.has(r.accountCode))
      .reduce((s, r) => s + r.debit - r.credit, 0),
  );
}

/** Compare GL cash/bank/AR/AP balances to operational subledger totals. */
export function buildReconciliationReport(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
  subledger: {
    cashOnHand: number;
    bankBalance: number;
    accountsReceivable: number;
    accountsPayable: number;
  },
  options?: { lebaneseCoa?: boolean },
): ReconciliationReport {
  const tb = buildTrialBalance(accounts, entries, lines, { endDate: asOfDate });
  const codes = options?.lebaneseCoa ? LEBANESE_PCG_GL_CODES : INTERNATIONAL_GL_CODES;

  const glCash = tbBalanceForCodes(tb, [...codes.cash]);
  const glBank = tbBalanceForCodes(tb, [...codes.bank]);
  const glAr = tbBalanceForCodes(tb, [...codes.ar]);
  const glAp = -tbBalanceForCodes(tb, [...codes.ap]);

  const rows: ReconciliationRow[] = [
    {
      label: 'Cash on Hand',
      glAmount: glCash,
      subledgerAmount: round2(subledger.cashOnHand),
      variance: 0,
      matched: false,
    },
    {
      label: 'Bank',
      glAmount: glBank,
      subledgerAmount: round2(subledger.bankBalance),
      variance: 0,
      matched: false,
    },
    {
      label: 'Accounts Receivable',
      glAmount: glAr,
      subledgerAmount: round2(subledger.accountsReceivable),
      variance: 0,
      matched: false,
    },
    {
      label: 'Accounts Payable',
      glAmount: glAp,
      subledgerAmount: round2(subledger.accountsPayable),
      variance: 0,
      matched: false,
    },
  ].map((r) => {
    const variance = round2(r.glAmount - r.subledgerAmount);
    return { ...r, variance, matched: variance === 0 };
  });

  return {
    asOfDate,
    rows,
    allMatched: rows.every((r) => r.matched),
  };
}
