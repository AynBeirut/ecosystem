/**
 * Unified money formatter (multi-currency Phase 2).
 *
 * ONE formatter for screen, PDF, email, reports, and WhatsApp — replaces the
 * scattered raw `.toFixed(2)` + hardcoded `$`, and the Invoice Manager's broken
 * `/1000 + "K"` LBP hack.
 *
 * Framework-agnostic (only imports ./currencies) so it syncs verbatim into the
 * vendored Invoice Manager and functions via scripts/sync-currency-lib.cjs.
 *
 * Design rules:
 *   - Base currency drives decimals (USD=2, LBP=0, JOD=3).
 *   - `full`    → grouped separators, currency-correct decimals (89,500,000.00 / 89,500,000).
 *   - `compact` → abbreviated (89.5M).
 *   - Secondary is a DISPLAY overlay only; requires an explicit positive rate.
 *     No silent 1:1 fallback — a missing/invalid rate simply omits the secondary.
 */
import { getCurrencyMeta, normalizeCurrencyCode } from './currencies';

export type NumberFormatStyle = 'full' | 'compact';

/**
 * Module-level default display style. The app runs in a single-store context per
 * page load, so the shell sets this once from the store's `numberFormat` toggle
 * and every formatMoney/formatCurrency call honors it without per-call-site edits.
 * An explicit `style` option always overrides this default.
 */
let defaultNumberFormatStyle: NumberFormatStyle = 'full';

export function setDefaultNumberFormat(style: unknown): void {
  defaultNumberFormatStyle = style === 'compact' ? 'compact' : 'full';
}

export function getDefaultNumberFormat(): NumberFormatStyle {
  return defaultNumberFormatStyle;
}

export interface SecondaryDisplay {
  /** Secondary currency code (display only). */
  currency: string;
  /** Units of secondary per 1 unit of base. Must be finite and > 0 to render. */
  rate: number;
}

export interface FormatMoneyOptions {
  /** Base currency code (from SSOT). Defaults to USD if unknown. */
  currency?: string;
  /** Full separators vs compact/abbreviated. Defaults to 'full'. */
  style?: NumberFormatStyle;
  /** Prepend/append the currency symbol. Defaults to true. */
  withSymbol?: boolean;
  /** Optional secondary/display currency overlay (Phase 3). */
  secondary?: SecondaryDisplay;
}

function formatNumber(value: number, decimals: number, style: NumberFormatStyle): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (style === 'compact') {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safe);
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

function withSymbolApplied(numberText: string, code: string): string {
  const meta = getCurrencyMeta(code);
  return meta.symbolPosition === 'before'
    ? `${meta.symbol}${numberText}`
    : `${numberText} ${meta.symbol}`;
}

/** Format a single amount in one currency (no secondary overlay). */
export function formatAmount(
  amount: number,
  currency?: string,
  style?: NumberFormatStyle,
  withSymbol = true,
): string {
  const code = normalizeCurrencyCode(currency);
  const meta = getCurrencyMeta(code);
  const numberText = formatNumber(amount, meta.decimals, style ?? defaultNumberFormatStyle);
  return withSymbol ? withSymbolApplied(numberText, code) : numberText;
}

/**
 * Main entry point. Formats a base amount and, when a valid secondary rate is
 * supplied, appends the converted display value in parentheses.
 *
 * The secondary value is computed at call time only — never persist it.
 */
export function formatMoney(amount: number, options: FormatMoneyOptions = {}): string {
  const { currency, style, withSymbol = true, secondary } = options;
  const base = formatAmount(amount, currency, style, withSymbol);

  if (
    secondary &&
    Number.isFinite(secondary.rate) &&
    secondary.rate > 0 &&
    normalizeCurrencyCode(secondary.currency) !== normalizeCurrencyCode(currency)
  ) {
    const converted = (Number.isFinite(amount) ? amount : 0) * secondary.rate;
    const secondaryText = formatAmount(converted, secondary.currency, style, withSymbol);
    return `${base} (≈ ${secondaryText})`;
  }

  return base;
}
