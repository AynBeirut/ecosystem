/** Shared order display helpers (matches web scheduledOrders format). */

export function parseOrderCreatedAt(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value === 'object' && value !== null) {
    const sec =
      'seconds' in value
        ? Number((value as { seconds: number }).seconds)
        : '_seconds' in value
          ? Number((value as { _seconds: number })._seconds)
          : NaN;
    if (Number.isFinite(sec)) return sec * 1000;
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

export function isOrderRelevantToday(order: { createdAt?: unknown; scheduledFor?: string; status?: string }) {
  if (order.status === 'pending') return true;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (parseOrderCreatedAt(order.createdAt) >= startOfToday.getTime()) return true;
  if (!order.scheduledFor) return false;
  return order.scheduledFor.slice(0, 10) === todayDateString();
}

/** Milliseconds for customer-requested date/time (scheduledFor), or 0 if missing/invalid. */
export function parseOrderScheduledFor(value?: string | null): number {
  if (!value?.trim()) return 0;
  const trimmed = value.trim();
  const iso = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  const normalized =
    iso.includes('T') && !iso.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)
      ? `${iso}+03:00`
      : iso;
  const t = Date.parse(normalized);
  return Number.isFinite(t) ? t : 0;
}

/** Scheduled orders first (soonest customer date), then unscheduled by newest created. */
export function compareOrdersByCustomerDate(
  a: { createdAt?: unknown; scheduledFor?: string | null },
  b: { createdAt?: unknown; scheduledFor?: string | null },
): number {
  const aSched = parseOrderScheduledFor(a.scheduledFor);
  const bSched = parseOrderScheduledFor(b.scheduledFor);
  if (aSched && bSched) return aSched - bSched;
  if (aSched && !bSched) return -1;
  if (!aSched && bSched) return 1;
  return parseOrderCreatedAt(b.createdAt) - parseOrderCreatedAt(a.createdAt);
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
