import { formatMoney } from '@/lib/money/format';

export type ReportCurrencyMode = 'LBP' | 'USD' | 'both';

export function normalizeLedgerCurrency(code?: string): string {
  const c = String(code || 'USD').toUpperCase();
  if (c === 'LL' || c === 'LBP' || c === 'LE' || c === 'L£') return 'LBP';
  return c;
}

/** Full grouped amount. LBP is always labeled LBP — never L£ / LE / compact K/M. */
export function formatLedgerAmount(amount: number, currency?: string): string {
  const code = normalizeLedgerCurrency(currency);
  const n = Number.isFinite(amount) ? amount : 0;
  const numberText = formatMoney(n, { currency: code, style: 'full', withSymbol: false });
  if (code === 'LBP') return `${numberText} LBP`;
  if (code === 'USD') return `$${numberText}`;
  return `${numberText} ${code}`;
}

/** `usdToLbp` = units of LBP per 1 USD. Missing/invalid rate → no conversion. */
export function convertLedgerAmount(
  amount: number,
  from: string,
  to: string,
  usdToLbp?: number,
): number | null {
  const a = normalizeLedgerCurrency(from);
  const b = normalizeLedgerCurrency(to);
  if (a === b) return amount;
  if (!usdToLbp || !(usdToLbp > 0)) return null;
  if (a === 'USD' && b === 'LBP') return amount * usdToLbp;
  if (a === 'LBP' && b === 'USD') return amount / usdToLbp;
  return null;
}

export function formatLedgerAmountForMode(
  amount: number,
  storeCurrency: string,
  mode: ReportCurrencyMode,
  usdToLbp?: number,
): string {
  const store = normalizeLedgerCurrency(storeCurrency);
  if (mode === 'both') {
    const other = store === 'LBP' ? 'USD' : 'LBP';
    const converted = convertLedgerAmount(amount, store, other, usdToLbp);
    const primary = formatLedgerAmount(amount, store);
    if (converted == null) return primary;
    return `${primary} (≈ ${formatLedgerAmount(converted, other)})`;
  }
  const converted = convertLedgerAmount(amount, store, mode, usdToLbp);
  if (converted == null) return formatLedgerAmount(amount, store);
  return formatLedgerAmount(converted, mode);
}

export function splitOpeningByNormalBalance(
  net: number,
  normalBalance: 'debit' | 'credit' = 'debit',
): { debit: number; credit: number } {
  const n = Number.isFinite(net) ? net : 0;
  if (!n) return { debit: 0, credit: 0 };
  if (normalBalance === 'credit') {
    return n >= 0 ? { debit: 0, credit: n } : { debit: Math.abs(n), credit: 0 };
  }
  return n >= 0 ? { debit: n, credit: 0 } : { debit: 0, credit: Math.abs(n) };
}

export function defaultOperationalAccountRange(
  accounts: Array<{ code: string; isActive?: boolean; isPcgChart?: boolean }>,
): { fromCode: string; toCode: string } {
  const ops = accounts
    .filter((a) => a.isActive !== false && !a.isPcgChart)
    .map((a) => String(a.code || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!ops.length) return { fromCode: '', toCode: '' };
  return { fromCode: ops[0], toCode: ops[ops.length - 1] };
}
