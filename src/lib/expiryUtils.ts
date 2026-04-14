/**
 * Returns the number of days until the given expiry date.
 * Positive = days remaining, negative = already expired (days past).
 * Returns Infinity if no expiry date is provided.
 */
export function getDaysUntilExpiry(expiryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns true if the item has expired (expiry date is in the past).
 */
export function isExpired(expiryDate: string): boolean {
  return getDaysUntilExpiry(expiryDate) < 0;
}

/**
 * Returns true if the item is expiring within the alert threshold.
 * Uses item.expiryAlertDays if set, otherwise defaults to 30 days.
 * Returns false if expiryTracking is false or expiryDate is not set.
 */
export function isExpiringSoon(item: {
  expiryTracking?: boolean;
  expiryDate?: string;
  expiryAlertDays?: number;
}): boolean {
  if (!item.expiryTracking || !item.expiryDate) return false;
  const threshold = item.expiryAlertDays ?? 30;
  const days = getDaysUntilExpiry(item.expiryDate);
  return days >= 0 && days <= threshold;
}

/**
 * Returns true if the item has expired (and expiry tracking is on).
 */
export function hasExpired(item: {
  expiryTracking?: boolean;
  expiryDate?: string;
}): boolean {
  if (!item.expiryTracking || !item.expiryDate) return false;
  return isExpired(item.expiryDate);
}
