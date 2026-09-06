import type { GrabioStoreProfile } from '@/lib/grabio/types';

export type FinanceCurrencyRateRow = {
  from_currency: string;
  to_currency: string;
  rate: number;
  is_default?: boolean;
  effective_date?: string;
};

function normCurrency(code: string): string {
  const c = String(code || '').toUpperCase();
  if (c === 'LL' || c === 'LE' || c === 'L£') return 'LBP';
  return c;
}

export function normalizeUsdToLbpRate(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Grabio Admin Profile → Exchange Rate (USD → LBP). */
export function resolveUsdToLbpFromProfile(
  profile?: Pick<GrabioStoreProfile, 'customExchangeRate'> & { usdToLbpRate?: number } | null,
): number | undefined {
  return normalizeUsdToLbpRate(profile?.customExchangeRate ?? profile?.usdToLbpRate);
}

/** Finance → Currency Settings default USD→LBP pair (amount × rate). */
export function resolveUsdToLbpFromCurrencySettings(
  rows: FinanceCurrencyRateRow[],
): number | undefined {
  const usdToLbp = pickPairRate(rows, 'USD', 'LBP');
  if (usdToLbp) return usdToLbp;
  const lbpToUsd = pickPairRate(rows, 'LBP', 'USD');
  return lbpToUsd ? 1 / lbpToUsd : undefined;
}

function pickPairRate(rows: FinanceCurrencyRateRow[], from: string, to: string): number | undefined {
  const f = normCurrency(from);
  const t = normCurrency(to);
  const pair = rows.filter((r) => normCurrency(r.from_currency) === f && normCurrency(r.to_currency) === t);
  if (!pair.length) return undefined;
  const def = pair.find((r) => r.is_default);
  const sorted = [...pair].sort((a, b) =>
    String(b.effective_date || '').localeCompare(String(a.effective_date || '')),
  );
  return normalizeUsdToLbpRate((def || sorted[0])?.rate);
}

/** Profile rate first, then Finance Currency Settings. */
export function resolveUsdToLbpRate(
  profile?: Pick<GrabioStoreProfile, 'customExchangeRate' | 'accountingMode' | 'secondaryCurrency' | 'exchangeRateMode'> & {
    usdToLbpRate?: number;
  } | null,
  currencySettings?: FinanceCurrencyRateRow[],
): number | undefined {
  return resolveUsdToLbpFromProfile(profile) ?? resolveUsdToLbpFromCurrencySettings(currencySettings || []);
}

/** When no manual/settings rate exists, finance loads live USD→LBP automatically. */
export function shouldFetchLiveUsdToLbpRate(storedRate?: number): boolean {
  return !(storedRate && storedRate > 0);
}
