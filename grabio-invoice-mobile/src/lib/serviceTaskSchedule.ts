import type { BillingType } from '../types';

export const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const;

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label:
    hour === 0
      ? '12 AM'
      : hour < 12
        ? `${hour} AM`
        : hour === 12
          ? '12 PM'
          : `${hour - 12} PM`,
}));

export function weekdayLabel(value: number): string {
  return WEEKDAY_OPTIONS.find((d) => d.value === value)?.label || 'Day';
}

export function hourLabel(value: number): string {
  return HOUR_OPTIONS.find((h) => h.value === value)?.label || `${value}:00`;
}

/** How many weekdays to pick for N occurrences/month (~4 weeks). */
export function weekDaysNeededPerMonth(monthlyUnits: number): number {
  if (monthlyUnits <= 0) return 1;
  return Math.min(7, Math.max(1, Math.ceil(monthlyUnits / 4)));
}

export function normalizeScheduleWeekdays(
  weekdays?: number[],
  legacyWeekday?: number,
): number[] {
  if (weekdays?.length) {
    return [...new Set(weekdays)].sort((a, b) => a - b);
  }
  if (legacyWeekday != null) return [legacyWeekday];
  return [];
}

export function weekdaysLabel(values: number[]): string {
  if (!values.length) return 'No days';
  return values.map(weekdayLabel).join(', ');
}

/** Next occurrence on any selected weekday at hour:minute strictly after `after`. */
export function computeNextFromWeekdays(
  weekdays: number[],
  hour: number,
  minute = 0,
  after = new Date(),
): Date | null {
  const days = normalizeScheduleWeekdays(weekdays);
  if (!days.length) return null;
  let best: Date | null = null;
  for (const weekday of days) {
    const candidate = computeNextMonthlyDue(weekday, hour, minute, after);
    if (!best || candidate.getTime() < best.getTime()) best = candidate;
  }
  return best;
}

/** Next occurrence of weekday at hour:minute strictly after `after`. */
export function computeNextMonthlyDue(
  weekday: number,
  hour: number,
  minute = 0,
  after = new Date(),
): Date {
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  const daysUntil = (weekday - next.getDay() + 7) % 7;
  if (daysUntil === 0 && next.getTime() <= after.getTime()) {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + daysUntil);
  }
  return next;
}

export function combineDateAndTime(date: Date, hour: number, minute = 0): Date {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function resolveServiceTaskNextDue(input: {
  billingType: BillingType;
  scheduledAt?: string;
  scheduleWeekdays?: number[];
  scheduleWeekday?: number;
  scheduleHour?: number;
  scheduleMinute?: number;
}): string | null {
  if (input.billingType === 'monthly') {
    const days = normalizeScheduleWeekdays(input.scheduleWeekdays, input.scheduleWeekday);
    if (!days.length || input.scheduleHour == null) return null;
    const next = computeNextFromWeekdays(days, input.scheduleHour, input.scheduleMinute ?? 0);
    return next?.toISOString() || null;
  }
  return input.scheduledAt || null;
}

export function formatServiceTaskSchedule(input: {
  billingType: BillingType;
  scheduledAt?: string;
  scheduleWeekdays?: number[];
  scheduleWeekday?: number;
  scheduleHour?: number;
  monthlyUnits?: number;
}): string {
  if (input.billingType === 'monthly') {
    const days = normalizeScheduleWeekdays(input.scheduleWeekdays, input.scheduleWeekday);
    if (!days.length || input.scheduleHour == null) return 'No schedule';
    const count = input.monthlyUnits ? `${input.monthlyUnits}/month · ` : '';
    return `${count}${weekdaysLabel(days)} at ${hourLabel(input.scheduleHour)}`;
  }
  if (!input.scheduledAt) return 'No date';
  const d = new Date(input.scheduledAt);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function toggleWeekdaySelection(current: number[], day: number, max: number): number[] {
  if (current.includes(day)) return current.filter((d) => d !== day);
  if (current.length >= max) return current;
  return [...current, day].sort((a, b) => a - b);
}
