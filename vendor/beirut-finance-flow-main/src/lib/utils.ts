
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatMoney, type NumberFormatStyle } from "@/lib/money/format"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Unified currency formatter. Delegates to the shared money lib so the Invoice
 * Manager, main app, and backend format identically. Honors per-currency
 * decimals (LBP=0, USD=2) and the store's large-number style — replaces the old
 * broken `/1000 + "K"` LBP hack.
 */
export function formatCurrency(amount: number, currency = 'USD', style?: NumberFormatStyle): string {
  return formatMoney(amount, { currency, style });
}

/** Document amount plus the other of USD / LBP. Rate is 1 USD = X LBP. */
export function formatDualCurrency(amount: number, currency = 'USD', usdToLbp?: number, style?: NumberFormatStyle): string {
  const code = String(currency || 'USD').toUpperCase();
  const isLbp = code === 'LBP' || code === 'LL' || code === 'LE';
  const primary = formatCurrency(amount, isLbp ? 'LBP' : code, style);
  if (!usdToLbp || usdToLbp <= 0) return primary;
  if (isLbp) return `${primary} · ${formatCurrency(amount / usdToLbp, 'USD', style)}`;
  if (code === 'USD') return `${primary} · ${formatCurrency(amount * usdToLbp, 'LBP', style)}`;
  return primary;
}
