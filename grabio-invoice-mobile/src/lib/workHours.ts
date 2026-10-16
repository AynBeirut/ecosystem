export const WORK_TIMEZONE = 'Asia/Beirut';
export const WORK_HOUR_START = 8;
export const WORK_HOUR_END = 19;
const WORK_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

function beirutParts(date = new Date()): { hour: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: WORK_TIMEZONE,
    hour: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  return { hour, weekday };
}

export function isWithinWorkHours(date = new Date()): boolean {
  const { hour, weekday } = beirutParts(date);
  if (!WORK_DAYS.has(weekday)) return false;
  return hour >= WORK_HOUR_START && hour < WORK_HOUR_END;
}

export function todayYmdBeirut(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WORK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
