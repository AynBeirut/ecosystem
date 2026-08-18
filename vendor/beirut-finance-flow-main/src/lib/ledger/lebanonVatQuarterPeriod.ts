export type VatQuarter = 1 | 2 | 3 | 4;

export const VAT_QUARTER_LABELS: Record<VatQuarter, string> = {
  1: 'الربع الأول (كانون الثاني – آذار)',
  2: 'الربع الثاني (نيسان – حزيران)',
  3: 'الربع الثالث (تموز – أيلول)',
  4: 'الربع الرابع (تشرين الأول – كانون الأول)',
};

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

export function quarterPeriodLabel(year: number, quarter: VatQuarter): string {
  const { startDate, endDate } = quarterBounds(year, quarter);
  return `${VAT_QUARTER_SHORT[quarter]} ${year} · ${startDate} → ${endDate}`;
}
