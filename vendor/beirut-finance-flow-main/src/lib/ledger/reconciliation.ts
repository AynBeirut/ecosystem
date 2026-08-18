import type { LedgerAccount, JournalEntry, JournalLine, TrialBalanceReport } from '@/types/generalLedger';
import { buildTrialBalance } from '@/lib/ledger/trialBalance';
import {
  isAccountsPayableCode,
  isAccountsReceivableCode,
  isBankLedgerAccount,
  isCashLedgerAccount,
  isOnlinePaymentLedgerAccount,
} from '@/lib/ledger/accountControlCodes';
import { compareLedgerAccountCode } from '@/lib/ledger/accountCodeSort';

export type ReconciliationGroup = 'cash' | 'bank' | 'online' | 'clients' | 'suppliers';

export interface ReconciliationRow {
  group: ReconciliationGroup;
  label: string;
  accountCode?: string;
  accountId?: string;
  glAmount: number;
  subledgerAmount: number;
  variance: number;
  matched: boolean;
  isTotal?: boolean;
  isPartyDetail?: boolean;
  supportsExternalImport?: boolean;
  externalImported?: boolean;
  rowKey: string;
}

export interface ReconciliationReport {
  asOfDate: string;
  rows: ReconciliationRow[];
  allMatched: boolean;
}

export interface ReconciliationSubledgerInput {
  cashOnHand: number;
  bankBalance: number;
  deliveryHeldCash: number;
  accountsReceivable: number;
  accountsPayable: number;
  arGlBalance: number;
  apGlBalance: number;
  clientBalances?: Array<{ name: string; amount: number }>;
  supplierBalances?: Array<{ name: string; amount: number }>;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const INTERNATIONAL_GL_CODES = {
  cash: ['102'],
  bank: ['106', '105'],
  online: ['103'],
  ar: ['110'],
  ap: ['201'],
} as const;

export const LEBANESE_PCG_GL_CODES = {
  cash: ['5300'],
  bank: ['5121', '5122', '5110'],
  online: ['1030'],
  ar: ['4111', '4110'],
  ap: ['4011'],
} as const;

export const LEBANESE_GRABIO_GL_CODES = {
  cash: ['102'],
  bank: ['105', '106'],
  online: ['103'],
  ar: ['110'],
  ap: ['201'],
} as const;

export function lebaneseGlLookupCodes(kind: keyof typeof LEBANESE_GRABIO_GL_CODES, lebaneseCoa?: boolean): string[] {
  const src = lebaneseCoa ? LEBANESE_GRABIO_GL_CODES : INTERNATIONAL_GL_CODES;
  return [...src[kind]];
}

export function tbBalanceForCodes(tb: TrialBalanceReport, codes: string[]): number {
  const codeSet = new Set(codes);
  return round2(
    tb.rows
      .filter((r) => codeSet.has(r.accountCode))
      .reduce((s, r) => s + r.debit - r.credit, 0),
  );
}

function glBalanceForAccount(account: LedgerAccount, tb: TrialBalanceReport): number {
  const row = tb.rows.find((r) => r.accountId === account.id);
  if (!row) return 0;
  if (isAccountsPayableCode(account.code) || account.normalBalance === 'credit') {
    return round2(row.credit - row.debit);
  }
  return round2(row.debit - row.credit);
}

function makeRow(
  partial: Omit<ReconciliationRow, 'variance' | 'matched' | 'rowKey'> & { rowKey?: string },
): ReconciliationRow {
  const variance = round2(partial.glAmount - partial.subledgerAmount);
  const rowKey =
    partial.rowKey ||
    `${partial.group}-${partial.accountId || partial.label}`.replace(/\s+/g, '_');
  return {
    ...partial,
    rowKey,
    variance,
    matched: variance === 0,
  };
}

function groupAccounts(accounts: LedgerAccount[]) {
  const active = accounts.filter((a) => a.isActive);
  return {
    cash: active.filter(isCashLedgerAccount).sort((a, b) => compareLedgerAccountCode(a.code, b.code)),
    bank: active.filter(isBankLedgerAccount).sort((a, b) => compareLedgerAccountCode(a.code, b.code)),
    online: active.filter(isOnlinePaymentLedgerAccount).sort((a, b) => compareLedgerAccountCode(a.code, b.code)),
    arControl: active.filter((a) => isAccountsReceivableCode(a.code)),
    apControl: active.filter((a) => isAccountsPayableCode(a.code)),
  };
}

/** Compare GL balances per account vs operational subledgers (cash, banks, online, AR/AP). */
export function buildReconciliationReport(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  lines: JournalLine[],
  asOfDate: string,
  subledger: ReconciliationSubledgerInput,
  options?: { lebaneseCoa?: boolean; externalByAccountId?: Record<string, number> },
): ReconciliationReport {
  const externalByAccountId = options?.externalByAccountId || {};
  const tb = buildTrialBalance(accounts, entries, lines, { endDate: asOfDate });
  const grouped = groupAccounts(accounts);
  const rows: ReconciliationRow[] = [];

  const cashAccounts = grouped.cash;
  let cashExternalSum = 0;
  let cashHasExternal = false;
  for (const account of cashAccounts) {
    const gl = glBalanceForAccount(account, tb);
    const ext = externalByAccountId[account.id];
    if (ext !== undefined) {
      cashHasExternal = true;
      cashExternalSum = round2(cashExternalSum + ext);
    }
    const sub =
      ext !== undefined
        ? round2(ext)
        : cashAccounts.length === 1
          ? round2(subledger.cashOnHand)
          : 0;
    rows.push(
      makeRow({
        group: 'cash',
        label: `${account.code} — ${account.name}`,
        accountCode: account.code,
        accountId: account.id,
        glAmount: gl,
        subledgerAmount: sub,
        supportsExternalImport: true,
        externalImported: ext !== undefined,
      }),
    );
  }
  if (cashAccounts.length === 0) {
    rows.push(
      makeRow({
        group: 'cash',
        label: 'Cash on hand',
        glAmount: 0,
        subledgerAmount: round2(subledger.cashOnHand),
      }),
    );
  } else if (cashAccounts.length > 1 || cashHasExternal) {
    const glTotal = round2(rows.filter((r) => r.group === 'cash' && !r.isTotal).reduce((s, r) => s + r.glAmount, 0));
    rows.push(
      makeRow({
        group: 'cash',
        label: 'Total cash',
        glAmount: glTotal,
        subledgerAmount: cashHasExternal ? cashExternalSum : round2(subledger.cashOnHand),
        isTotal: true,
      }),
    );
  }

  const bankAccounts = grouped.bank;
  let bankGlRunning = 0;
  let bankExternalSum = 0;
  let bankHasExternal = false;
  for (const account of bankAccounts) {
    const gl = glBalanceForAccount(account, tb);
    bankGlRunning = round2(bankGlRunning + gl);
    const ext = externalByAccountId[account.id];
    if (ext !== undefined) {
      bankHasExternal = true;
      bankExternalSum = round2(bankExternalSum + ext);
    }
    rows.push(
      makeRow({
        group: 'bank',
        label: `${account.code} — ${account.name}`,
        accountCode: account.code,
        accountId: account.id,
        glAmount: gl,
        subledgerAmount: ext !== undefined ? round2(ext) : 0,
        supportsExternalImport: true,
        externalImported: ext !== undefined,
      }),
    );
  }
  if (bankAccounts.length === 0) {
    rows.push(
      makeRow({
        group: 'bank',
        label: 'Bank accounts',
        glAmount: 0,
        subledgerAmount: round2(subledger.bankBalance),
      }),
    );
  } else {
    rows.push(
      makeRow({
        group: 'bank',
        label: bankAccounts.length === 1 ? 'Bank total' : 'Total bank (all accounts)',
        glAmount: bankGlRunning,
        subledgerAmount: bankHasExternal ? bankExternalSum : round2(subledger.bankBalance),
        isTotal: true,
      }),
    );
  }

  const onlineAccounts = grouped.online;
  let onlineGlRunning = 0;
  let onlineExternalSum = 0;
  let onlineHasExternal = false;
  for (const account of onlineAccounts) {
    const gl = glBalanceForAccount(account, tb);
    onlineGlRunning = round2(onlineGlRunning + gl);
    const ext = externalByAccountId[account.id];
    if (ext !== undefined) {
      onlineHasExternal = true;
      onlineExternalSum = round2(onlineExternalSum + ext);
    }
    rows.push(
      makeRow({
        group: 'online',
        label: `${account.code} — ${account.name}`,
        accountCode: account.code,
        accountId: account.id,
        glAmount: gl,
        subledgerAmount:
          ext !== undefined
            ? round2(ext)
            : onlineAccounts.length === 1
              ? round2(subledger.deliveryHeldCash)
              : 0,
        supportsExternalImport: true,
        externalImported: ext !== undefined,
      }),
    );
  }
  if (onlineAccounts.length === 0) {
    rows.push(
      makeRow({
        group: 'online',
        label: 'Online / wallet payments',
        glAmount: tbBalanceForCodes(tb, lebaneseGlLookupCodes('online', options?.lebaneseCoa)),
        subledgerAmount: round2(subledger.deliveryHeldCash),
      }),
    );
  } else if (onlineAccounts.length > 1 || onlineHasExternal) {
    rows.push(
      makeRow({
        group: 'online',
        label: 'Total online / wallet',
        glAmount: onlineGlRunning,
        subledgerAmount: onlineHasExternal ? onlineExternalSum : round2(subledger.deliveryHeldCash),
        isTotal: true,
      }),
    );
  }

  const arGl =
    subledger.arGlBalance ||
    round2(grouped.arControl.reduce((s, a) => s + glBalanceForAccount(a, tb), 0));
  rows.push(
    makeRow({
      group: 'clients',
      label: grouped.arControl.length
        ? `${grouped.arControl.map((a) => a.code).join(', ')} — AR control`
        : 'Accounts receivable (control)',
      glAmount: arGl,
      subledgerAmount: round2(subledger.accountsReceivable),
      isTotal: true,
    }),
  );
  for (const client of subledger.clientBalances || []) {
    if (client.amount <= 0) continue;
    rows.push(
      makeRow({
        group: 'clients',
        label: client.name,
        glAmount: 0,
        subledgerAmount: round2(client.amount),
        isPartyDetail: true,
      }),
    );
  }

  const apGl =
    subledger.apGlBalance ||
    round2(grouped.apControl.reduce((s, a) => s + glBalanceForAccount(a, tb), 0));
  rows.push(
    makeRow({
      group: 'suppliers',
      label: grouped.apControl.length
        ? `${grouped.apControl.map((a) => a.code).join(', ')} — AP control`
        : 'Accounts payable (control)',
      glAmount: apGl,
      subledgerAmount: round2(subledger.accountsPayable),
      isTotal: true,
    }),
  );
  for (const supplier of subledger.supplierBalances || []) {
    if (supplier.amount <= 0) continue;
    rows.push(
      makeRow({
        group: 'suppliers',
        label: supplier.name,
        glAmount: 0,
        subledgerAmount: round2(supplier.amount),
        isPartyDetail: true,
      }),
    );
  }

  const controlRows = rows.filter((r) => r.isTotal || (!r.isPartyDetail && r.group !== 'clients' && r.group !== 'suppliers'));
  const partyControlRows = rows.filter((r) => r.isTotal && (r.group === 'clients' || r.group === 'suppliers'));
  const varianceRows = [...controlRows.filter((r) => !r.isPartyDetail), ...partyControlRows];

  return {
    asOfDate,
    rows,
    allMatched: varianceRows.every((r) => r.matched),
  };
}

export function reconciliationToCsv(report: ReconciliationReport): string {
  const header = ['Group', 'Account', 'GL', 'Subledger', 'Variance', 'Status'];
  const groupLabels: Record<ReconciliationGroup, string> = {
    cash: 'Cash',
    bank: 'Bank',
    online: 'Online payment',
    clients: 'Clients',
    suppliers: 'Suppliers',
  };
  const body = report.rows.map((r) => [
    groupLabels[r.group],
    r.label,
    String(r.glAmount),
    String(r.subledgerAmount),
    String(r.variance),
    r.matched ? 'Matched' : 'Variance',
  ]);
  return [header.join(','), ...body.map((row) => row.join(','))].join('\n');
}
