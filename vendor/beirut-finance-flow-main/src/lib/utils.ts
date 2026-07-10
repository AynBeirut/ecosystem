
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const code = String(currency || 'USD').trim().toUpperCase() || 'USD';
  const safeCode = /^[A-Z]{3}$/.test(code) ? code : 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: safeCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Special case for Lebanese Pound - show in thousands
  if (safeCode === 'LBP' && amount >= 1000) {
    const inThousands = amount / 1000;
    return `${formatter.format(inThousands)}K`;
  }
  
  return formatter.format(amount);
}
