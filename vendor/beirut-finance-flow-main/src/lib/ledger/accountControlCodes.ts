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
