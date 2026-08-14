import type { LedgerAccount } from '@/types/generalLedger';

/** Numeric value for range comparisons (41110 → 41110). */
export function accountCodeNumeric(code: string): number {
  const digits = String(code || '').replace(/\D/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/** PCG / standard COA classes 1–7 (assets through off-balance). */
export function isChartClass17Code(code: string): boolean {
  const first = String(code || '').trim()[0];
  return first >= '1' && first <= '7';
}

export function isAccountInCodeRange(code: string, fromCode: string, toCode: string): boolean {
  const raw = String(code || '').trim();
  const from = String(fromCode || '').trim();
  const to = String(toCode || '').trim();
  if (!raw || !from || !to) return false;

  const [loStr, hiStr] = from <= to ? [from, to] : [to, from];

  if (from.length === to.length && raw.length >= from.length) {
    const segment = raw.slice(0, from.length);
    if (segment >= loStr && segment <= hiStr) return true;
  }

  const value = accountCodeNumeric(raw);
  let fromNum = accountCodeNumeric(from);
  let toNum = accountCodeNumeric(to);
  if (fromNum > toNum) [fromNum, toNum] = [toNum, fromNum];
  if (value >= fromNum && value <= toNum) return true;

  if (from.length <= 3 && to.length <= 3 && toNum - fromNum <= 200) {
    for (let prefix = fromNum; prefix <= toNum; prefix += 1) {
      if (raw.startsWith(String(prefix))) return true;
    }
  }

  return false;
}

export function accountsInCodeRange(
  accounts: LedgerAccount[],
  fromCode: string,
  toCode: string,
  options?: { classes17Only?: boolean; activeOnly?: boolean },
): LedgerAccount[] {
  const activeOnly = options?.activeOnly !== false;
  const classes17Only = options?.classes17Only !== false;
  return accounts
    .filter((account) => {
      if (activeOnly && !account.isActive) return false;
      if (classes17Only && !isChartClass17Code(account.code)) return false;
      return isAccountInCodeRange(account.code, fromCode, toCode);
    })
    .sort((a, b) => accountCodeNumeric(a.code) - accountCodeNumeric(b.code));
}
