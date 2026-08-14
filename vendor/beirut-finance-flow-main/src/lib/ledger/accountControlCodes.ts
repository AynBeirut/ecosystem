import type { LedgerAccount } from '@/types/generalLedger';

/** AR sub-ledger: PCG 411x (clients) or Grabio 110. */
export function isAccountsReceivableCode(code: string): boolean {
  const c = String(code || '').trim();
  return c.startsWith('411') || c === '110' || c.startsWith('110');
}

/** AP sub-ledger: PCG 401x (suppliers) or Grabio 201. */
export function isAccountsPayableCode(code: string): boolean {
  const c = String(code || '').trim();
  return c.startsWith('401') || c === '201' || c.startsWith('201');
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

export function pickDefaultApAccount(accounts: LedgerAccount[]): LedgerAccount | undefined {
  return (
    accounts.find((a) => a.isActive && isAccountsPayableCode(a.code) && a.code.startsWith('401')) ||
    accounts.find((a) => a.isActive && isAccountsPayableCode(a.code))
  );
}

export function pickDefaultArAccount(accounts: LedgerAccount[]): LedgerAccount | undefined {
  return (
    accounts.find((a) => a.isActive && isAccountsReceivableCode(a.code) && a.code.startsWith('411')) ||
    accounts.find((a) => a.isActive && isAccountsReceivableCode(a.code))
  );
}
