
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
