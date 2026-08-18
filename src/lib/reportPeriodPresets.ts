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

export type VatQuarter = 1 | 2 | 3 | 4;

export const VAT_QUARTER_SHORT: Record<VatQuarter, string> = {
  1: 'Q1',
  2: 'Q2',
  3: 'Q3',
  4: 'Q4',
};

export function currentVatQuarter(date = new Date()): VatQuarter {
  return (Math.floor(date.getMonth() / 3) + 1) as VatQuarter;
}

export function quarterBounds(year: number, quarter: VatQuarter): { startDate: string; endDate: string } {
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 2;
  const startDate = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
  const endDay = new Date(year, endMonth + 1, 0).getDate();
  const endDate = `${year}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return { startDate, endDate };
}
