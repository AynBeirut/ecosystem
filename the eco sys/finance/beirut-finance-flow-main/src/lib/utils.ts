
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  // Special case for Lebanese Pound - show in thousands
  if (currency === 'LBP' && amount >= 1000) {
    const inThousands = amount / 1000;
    return `${formatter.format(inThousands)}K`;
  }
  
  return formatter.format(amount);
}
