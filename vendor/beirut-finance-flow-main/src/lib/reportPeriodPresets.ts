export function normalizeDateRange(start: string, end: string): { startDate: string; endDate: string } {
  const startDate = start.trim();
  const endDate = end.trim();
  if (!startDate || !endDate) return { startDate, endDate };
  if (startDate <= endDate) return { startDate, endDate };
  return { startDate: endDate, endDate: startDate };
}

/** @deprecated Use normalizeDateRange with always-visible custom dates. */
export type PeriodPreset = 'today' | 'month' | 'year' | 'custom';

/** @deprecated Use normalizeDateRange — all pages use custom from/to dates. */
export function resolvePeriodRange(
  preset: PeriodPreset,
  customStart = '',
  customEnd = '',
): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = customEnd || now.toISOString().slice(0, 10);

  if (preset === 'today') {
    const today = now.toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }
  if (preset === 'month') {
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { startDate, endDate };
  }
  if (preset === 'year') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate };
  }
  return normalizeDateRange(customStart || `${now.getFullYear()}-01-01`, endDate);
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: 'Today',
  month: 'This month',
  year: 'This year',
  custom: 'Custom range',
};
