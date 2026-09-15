export type PurchaseDatePreset = 'all' | 'today' | 'month' | 'custom';

export function localYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolvePurchasePeriodRange(
  preset: PurchaseDatePreset,
  customStart = '',
  customEnd = '',
): { startDate: string; endDate: string } | null {
  if (preset === 'all') return null;
  const now = new Date();
  const endDate = customEnd.trim() || localYmd(now);

  if (preset === 'today') {
    const today = localYmd(now);
    return { startDate: today, endDate: today };
  }
  if (preset === 'month') {
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { startDate, endDate };
  }
  const start = customStart.trim() || `${now.getFullYear()}-01-01`;
  const end = endDate;
  if (start <= end) return { startDate: start, endDate: end };
  return { startDate: end, endDate: start };
}

export function purchaseOnDate(orderDateIso: string): string {
  const raw = String(orderDateIso || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isFinite(d.getTime())) return localYmd(d);
  return '';
}

export function purchaseInPeriod(orderDateIso: string, range: { startDate: string; endDate: string } | null): boolean {
  if (!range) return true;
  const ymd = purchaseOnDate(orderDateIso);
  if (!ymd) return false;
  return ymd >= range.startDate && ymd <= range.endDate;
}
