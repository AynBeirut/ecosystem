import type { LedgerAccount } from '@/types/generalLedger';

function accountHead(code: string): number {
  return parseInt(String(code || '').split('.')[0], 10);
}

/** AR sub-ledger: PCG 411x (clients) or Grabio 110/112. */
export function isAccountsReceivableCode(code: string): boolean {
  const c = String(code || '').trim();
  if (/^\d{3}$/.test(c)) {
    return c === '110' || c === '112';
  }
  const head = accountHead(c);
  return Number.isFinite(head) && head >= 4110 && head < 4300;
}

/** AP sub-ledger: PCG 401x (suppliers) or Grabio 201/202/210 — not Grabio 401 revenue. */
export function isAccountsPayableCode(code: string): boolean {
  const c = String(code || '').trim();
  if (/^\d{3}$/.test(c)) {
    return c === '201' || c === '202' || c === '210';
  }
  const head = accountHead(c);
  return Number.isFinite(head) && head >= 4010 && head < 4200;
}

export function isKnockOffAccountCode(code: string): boolean {
  return isAccountsReceivableCode(code) || isAccountsPayableCode(code);
}

const CASH_BANK_GRABIO = new Set(['101', '102', '103', '105', '106', '108']);
const CASH_BANK_PCG = new Set(['5300', '5110', '5121', '5122']);

/** Cash drawer, bank, and cheques-under-collection style accounts for PV/RV. */
export function isCashOrBankCode(code: string): boolean {
  const c = String(code || '').trim();
  if (CASH_BANK_GRABIO.has(c)) return true;
  if (CASH_BANK_PCG.has(c)) return true;
  if (c.startsWith('512') || c.startsWith('511') || c.startsWith('530')) return true;
  return false;
}

const ONLINE_PAYMENT_GRABIO = new Set(['103', '108']);

export function isCashLedgerAccount(account: LedgerAccount): boolean {
  const op = String(account.grabioOperationalCode || account.code || '').trim();
  if (op === '102' || op === '101') return true;
  const code = String(account.code || '').trim();
  return code === '5300' || code.startsWith('530');
}

export function isBankLedgerAccount(account: LedgerAccount): boolean {
  if (isCashLedgerAccount(account)) return false;
  const op = String(account.grabioOperationalCode || account.code || '').trim();
  if (op === '105' || op === '106') return true;
  const code = String(account.code || '').trim();
  return code.startsWith('512') || code.startsWith('511');
}

export function isOnlinePaymentLedgerAccount(account: LedgerAccount): boolean {
  const op = String(account.grabioOperationalCode || account.code || '').trim();
  if (ONLINE_PAYMENT_GRABIO.has(op)) return true;
  const code = String(account.code || '').trim();
  if (ONLINE_PAYMENT_GRABIO.has(code)) return true;
  return /online|wish|card|wallet|gateway|whish/i.test(String(account.name || ''));
}

export function pickDefaultApAccount(accounts: LedgerAccount[]): LedgerAccount | undefined {
  return (
    accounts.find((a) => a.isActive && a.code === '201') ||
    accounts.find((a) => a.isActive && isAccountsPayableCode(a.code) && a.type === 'liability')
  );
}

export function pickDefaultArAccount(accounts: LedgerAccount[]): LedgerAccount | undefined {
  return (
    accounts.find((a) => a.isActive && a.code === '110') ||
    accounts.find((a) => a.isActive && isAccountsReceivableCode(a.code) && a.type === 'asset')
  );
}
