const ALL_WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

export function getOpenWeekdays(workingDays: string | null | undefined): Set<number> {
  const normalized = String(workingDays || '').trim().toLowerCase();
  if (!normalized || normalized === 'every day' || normalized === 'monday to sunday') return new Set(ALL_WEEKDAYS);
  if (normalized === 'monday to friday') return new Set([1, 2, 3, 4, 5]);
  if (normalized === 'monday to saturday') return new Set([1, 2, 3, 4, 5, 6]);
  return new Set(ALL_WEEKDAYS);
}

export function weekdayFromDateString(dateStr: string): number | null {
  const match = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month, day).getDay();
}

export function isStoreOpenOnDate(dateStr: string, workingDays: string | null | undefined): boolean {
  const weekday = weekdayFromDateString(dateStr);
  if (weekday === null) return true;
  return getOpenWeekdays(workingDays).has(weekday);
}

export function getStoreClosedDayMessage(
  workingDays: string | null | undefined,
  workingHours?: string | null,
): string {
  const daysLabel = String(workingDays || '').trim() || 'Every day';
  const hoursPart = workingHours?.trim() ? ` (${workingHours.trim()})` : '';
  return `We're closed on that day — please choose another date. We're open ${daysLabel}${hoursPart}.`;
}
