/** Shared order display helpers (matches web scheduledOrders format). */

export function parseOrderCreatedAt(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOrderRelevantToday(order: { createdAt?: unknown; scheduledFor?: string }) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (parseOrderCreatedAt(order.createdAt) >= startOfToday.getTime()) return true;
  if (!order.scheduledFor) return false;
  return order.scheduledFor.slice(0, 10) === todayDateString();
}

export function formatScheduledForDisplay(value?: string) {
  if (!value) return '';
  const trimmed = value.trim();
  const iso = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const date = new Date(iso.includes('T') && !iso.includes('Z') ? `${iso}+03:00` : iso);
  if (Number.isNaN(date.getTime())) return trimmed.replace('T', ' ');
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
