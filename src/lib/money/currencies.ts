/**
 * Single source of truth for supported currencies (multi-currency Phase 1).
 *
 * Framework-agnostic (no imports) so it can be synced verbatim into the
 * vendored Invoice Manager via scripts/sync-currency-lib.cjs.
 *
 * Replaces the two prior conflicting lists:
 *   - src/pages/CurrencySettings.tsx (8 codes, no metadata) [vendor]
 *   - src/services/mockData.ts (3 codes + symbols) [vendor]
 */

export type SymbolPosition = 'before' | 'after';

export interface CurrencyMeta {
  /** ISO 4217 code, e.g. 'USD'. */
  code: string;
  /** Display symbol, e.g. '$'. */
  symbol: string;
  /** Human-readable name. */
  name: string;
  /** Minor-unit digits: USD=2, LBP=0, JOD=3. */
  decimals: number;
  /** Where the symbol sits relative to the number. */
  symbolPosition: SymbolPosition;
}

/** Ordered list — order is used for dropdowns. USD first (platform default). */
export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, symbolPosition: 'before' },
  { code: 'LBP', symbol: 'L£', name: 'Lebanese Pound', decimals: 0, symbolPosition: 'after' },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, symbolPosition: 'before' },
  { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, symbolPosition: 'before' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', decimals: 2, symbolPosition: 'after' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', decimals: 2, symbolPosition: 'after' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', decimals: 2, symbolPosition: 'before' },
  { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar', decimals: 3, symbolPosition: 'after' },
];

export const DEFAULT_CURRENCY_CODE = 'USD';

const CURRENCY_BY_CODE: Record<string, CurrencyMeta> = SUPPORTED_CURRENCIES.reduce(
  (acc, c) => {
    acc[c.code] = c;
    return acc;
  },
  {} as Record<string, CurrencyMeta>,
);

/** All supported ISO codes. */
export const SUPPORTED_CURRENCY_CODES: string[] = SUPPORTED_CURRENCIES.map((c) => c.code);

/** True if `code` is a supported currency. */
export function isSupportedCurrency(code: unknown): boolean {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(CURRENCY_BY_CODE, code.toUpperCase());
}

/**
 * Normalize any input to a supported ISO code, falling back to USD.
 * Never throws — safe for write paths that must always produce a valid code.
 */
export function normalizeCurrencyCode(code: unknown): string {
  if (typeof code === 'string') {
    const upper = code.trim().toUpperCase();
    if (CURRENCY_BY_CODE[upper]) return upper;
  }
  return DEFAULT_CURRENCY_CODE;
}

/** Metadata for a code (falls back to USD metadata if unknown). */
export function getCurrencyMeta(code: unknown): CurrencyMeta {
  return CURRENCY_BY_CODE[normalizeCurrencyCode(code)];
}

/** Minor-unit digit count for a currency (USD=2, LBP=0, JOD=3). */
export function getCurrencyDecimals(code: unknown): number {
  return getCurrencyMeta(code).decimals;
}
