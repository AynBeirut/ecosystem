/** Default timezone offset for stores without profile timezone (Lebanon = +03:00). */
export const DEFAULT_STORE_UTC_OFFSET = '+03:00';

export type ScheduledOrderReminderFields = {
  scheduledFor?: string | null;
  scheduledReminder1hSentAt?: string | null;
  scheduledReminder30mSentAt?: string | null;
  status?: string | null;
};

/** Parse YYYY-MM-DDTHH:mm (no timezone) using store-local offset. */
export function parseScheduledFor(
  value: string | null | undefined,
  utcOffset = DEFAULT_STORE_UTC_OFFSET,
): Date | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.includes('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = trimmed.length === 16 ? `${trimmed}:00${utcOffset}` : `${trimmed}${utcOffset}`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatScheduledForDisplay(
  value: string | null | undefined,
  utcOffset = DEFAULT_STORE_UTC_OFFSET,
): string {
  const date = parseScheduledFor(value, utcOffset);
  if (!date) return value || '—';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date);
}

export function getMinutesUntilScheduled(
  value: string | null | undefined,
  now = new Date(),
  utcOffset = DEFAULT_STORE_UTC_OFFSET,
): number | null {
  const target = parseScheduledFor(value, utcOffset);
  if (!target) return null;
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

export function shouldSendScheduledReminder1h(order: ScheduledOrderReminderFields, now = new Date()): boolean {
  if (!order.scheduledFor || order.scheduledReminder1hSentAt) return false;
  if (order.status && !['pending', 'confirmed'].includes(order.status)) return false;
  const mins = getMinutesUntilScheduled(order.scheduledFor, now);
  return mins !== null && mins <= 60 && mins > 30;
}

export function shouldSendScheduledReminder30m(order: ScheduledOrderReminderFields, now = new Date()): boolean {
  if (!order.scheduledFor || order.scheduledReminder30mSentAt) return false;
  if (order.status && !['pending', 'confirmed'].includes(order.status)) return false;
  const mins = getMinutesUntilScheduled(order.scheduledFor, now);
  return mins !== null && mins <= 30 && mins > 0;
}

export function isPendingScheduledOrder(order: { status?: string | null; scheduledFor?: string | null }): boolean {
  return order.status === 'pending' && !!order.scheduledFor;
}
