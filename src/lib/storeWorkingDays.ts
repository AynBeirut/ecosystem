/** Weekday index: 0 = Sunday … 6 = Saturday (matches Date.getDay()). */
const ALL_WEEKDAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

const WEEKDAY_FROM_NAME: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Map admin delivery setting to open weekdays. */
export function getOpenWeekdays(workingDays: string | null | undefined): Set<number> {
  const normalized = String(workingDays || '').trim().toLowerCase();
  if (!normalized || normalized === 'every day' || normalized === 'monday to sunday') return new Set(ALL_WEEKDAYS);
  if (normalized === 'monday to friday') return new Set([1, 2, 3, 4, 5]);
  if (normalized === 'monday to saturday') return new Set([1, 2, 3, 4, 5, 6]);
  return new Set(ALL_WEEKDAYS);
}

export function intersectOpenWeekdays(workingDaysList: string[]): Set<number> {
  if (workingDaysList.length === 0) return getOpenWeekdays('Every day');
  let result = getOpenWeekdays(workingDaysList[0]);
  for (let i = 1; i < workingDaysList.length; i++) {
    const next = getOpenWeekdays(workingDaysList[i]);
    result = new Set([...result].filter((day) => next.has(day)));
  }
  return result;
}

/** Parse YYYY-MM-DD as local calendar date (no UTC shift). */
export function weekdayFromDateString(dateStr: string): number | null {
  const match = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month, day).getDay();
}

export function formatWorkingDaysLabel(workingDays: string | null | undefined): string {
  const value = String(workingDays || '').trim();
  if (!value) return 'Every day';
  return value;
}

export function isStoreOpenOnDate(
  dateStr: string,
  workingDays: string | null | undefined,
): boolean {
  const weekday = weekdayFromDateString(dateStr);
  if (weekday === null) return true;
  return getOpenWeekdays(workingDays).has(weekday);
}

export function isStoreOpenOnDateForStores(
  dateStr: string,
  workingDaysList: string[],
): boolean {
  const weekday = weekdayFromDateString(dateStr);
  if (weekday === null) return true;
  return intersectOpenWeekdays(workingDaysList).has(weekday);
}

export function getStoreClosedDayMessage(
  workingDays: string | null | undefined,
  workingHours?: string | null,
): string {
  const daysLabel = formatWorkingDaysLabel(workingDays);
  const hoursPart = workingHours?.trim() ? ` (${workingHours.trim()})` : '';
  return `We're closed on that day — please choose another date. We're open ${daysLabel}${hoursPart}.`;
}

export function getWeekdayName(dateStr: string): string | null {
  const weekday = weekdayFromDateString(dateStr);
  if (weekday === null) return null;
  return WEEKDAY_LABELS[weekday] || null;
}

export { WEEKDAY_FROM_NAME, WEEKDAY_LABELS };
