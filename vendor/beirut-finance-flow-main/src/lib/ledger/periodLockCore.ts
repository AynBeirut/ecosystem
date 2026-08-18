import type { LedgerPeriodClosure, PeriodLockType } from '@/types/generalLedger';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export class PeriodLockedError extends Error {
  readonly periodId: string;
  readonly code = 'PERIOD_LOCKED';

  constructor(message: string, periodId: string) {
    super(message);
    this.name = 'PeriodLockedError';
    this.periodId = periodId;
  }
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse voucher/journal date input (YYYY-MM-DD or ISO) without timezone day shift. */
export function parseJournalDateInput(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Journal date is required.');
  const dateOnly = raw.slice(0, 10);
  if (!DATE_ONLY_RE.test(dateOnly)) throw new Error('Invalid journal date.');
  const [, month, day] = dateOnly.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new Error('Invalid journal date.');
  const iso = `${dateOnly}T12:00:00.000Z`;
  if (Number.isNaN(new Date(iso).getTime())) throw new Error('Invalid journal date.');
  return iso;
}

export function journalDateOnly(value: string): string {
  return parseJournalDateInput(value).slice(0, 10);
}

export function normalizeJournalDate(dateIso: string): string {
  const raw = String(dateIso || '').trim();
  if (DATE_ONLY_RE.test(raw)) return journalDateOnly(raw);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid journal date.');
  return d.toISOString().slice(0, 10);
}

export function periodIdForMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function periodIdForQuarter(year: number, quarter: number): string {
  if (quarter < 1 || quarter > 4) throw new Error('Quarter must be 1–4.');
  return `${year}-Q${quarter}`;
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildMonthPeriod(year: number, month: number) {
  if (month < 1 || month > 12) throw new Error('Month must be 1–12.');
  const id = periodIdForMonth(year, month);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`;
  return {
    id,
    periodType: 'month' as PeriodLockType,
    startDate,
    endDate,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

export function buildQuarterPeriod(year: number, quarter: number) {
  if (quarter < 1 || quarter > 4) throw new Error('Quarter must be 1–4.');
  const specs = [
    { start: `${year}-01-01`, end: `${year}-03-30`, label: `Q1 ${year} (Jan 1 – Mar 30)` },
    { start: `${year}-04-01`, end: `${year}-06-30`, label: `Q2 ${year} (Apr 1 – Jun 30)` },
    { start: `${year}-07-01`, end: `${year}-09-30`, label: `Q3 ${year} (Jul 1 – Sep 30)` },
    { start: `${year}-10-01`, end: `${year}-12-30`, label: `Q4 ${year} (Oct 1 – Dec 30)` },
  ];
  const spec = specs[quarter - 1];
  return {
    id: periodIdForQuarter(year, quarter),
    periodType: 'quarter' as PeriodLockType,
    startDate: spec.start,
    endDate: spec.end,
    label: spec.label,
  };
}

/** Which fiscal quarter contains this journal date (30th-based quarters). */
export function resolveFiscalQuarterForDate(dateIso: string): { year: number; quarter: number } {
  const d = normalizeJournalDate(dateIso);
  const year = Number(d.slice(0, 4));
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    const period = buildQuarterPeriod(year, quarter);
    if (dateInRange(d, period.startDate, period.endDate)) {
      return { year, quarter };
    }
  }
  // Mar 31 / Dec 31 gap days lock with the preceding quarter.
  if (d.endsWith('-03-31')) return { year, quarter: 1 };
  if (d.endsWith('-12-31')) return { year, quarter: 4 };
  throw new Error(`Date ${d} falls outside fiscal quarters.`);
}

export function isQuarterAutoClosed(endDate: string, asOfDate: string): boolean {
  return normalizeJournalDate(asOfDate) > normalizeJournalDate(endDate);
}

export function listQuartersNeedingAutoClose(
  asOfDate: string,
  existing: LedgerPeriodClosure[],
  fromYear: number,
  toYear: number,
): Array<{ year: number; quarter: number }> {
  const closedIds = new Set(existing.filter((row) => row.isClosed).map((row) => row.id));
  const due: Array<{ year: number; quarter: number }> = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const period = buildQuarterPeriod(year, quarter);
      if (closedIds.has(period.id)) continue;
      if (isQuarterAutoClosed(period.endDate, asOfDate)) {
        due.push({ year, quarter });
      }
    }
  }
  return due;
}

export function synthesizeClosedPeriod(
  storeId: string,
  year: number,
  quarter: number,
): LedgerPeriodClosure {
  const period = buildQuarterPeriod(year, quarter);
  const now = new Date().toISOString();
  return {
    id: period.id,
    storeId,
    periodType: 'quarter',
    startDate: period.startDate,
    endDate: period.endDate,
    label: period.label,
    isClosed: true,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function findLockedPeriodForDate(
  dateIso: string,
  closures: LedgerPeriodClosure[],
  asOfDate: string = journalDateOnly(new Date().toISOString()),
): LedgerPeriodClosure | null {
  const explicit = findClosedPeriodForDate(dateIso, closures);
  if (explicit) return explicit;

  const { year, quarter } = resolveFiscalQuarterForDate(dateIso);
  const period = buildQuarterPeriod(year, quarter);
  if (!isQuarterAutoClosed(period.endDate, asOfDate)) return null;

  const stored = closures.find((row) => row.id === period.id);
  if (stored?.isClosed) return stored;
  return synthesizeClosedPeriod('', year, quarter);
}

export function dateInRange(date: string, startDate: string, endDate: string): boolean {
  const d = normalizeJournalDate(date);
  return d >= startDate && d <= endDate;
}

export function findClosedPeriodForDate(
  dateIso: string,
  closures: LedgerPeriodClosure[],
): LedgerPeriodClosure | null {
  const d = normalizeJournalDate(dateIso);
  return (
    closures.find((c) => c.isClosed && dateInRange(d, c.startDate, c.endDate)) ?? null
  );
}

export function assertDateNotInClosedPeriod(
  dateIso: string,
  closures: LedgerPeriodClosure[],
  action = 'post journal entries',
  asOfDate?: string,
): void {
  const closed = findLockedPeriodForDate(dateIso, closures, asOfDate);
  if (closed) {
    throw new PeriodLockedError(
      `Period ${closed.label} is closed — cannot ${action} dated ${normalizeJournalDate(dateIso)}.`,
      closed.id,
    );
  }
}

export function periodContainingAsOfDate(asOfDate: string, closures: LedgerPeriodClosure[]): LedgerPeriodClosure | null {
  const d = normalizeJournalDate(asOfDate);
  try {
    const { year, quarter } = resolveFiscalQuarterForDate(d);
    const period = buildQuarterPeriod(year, quarter);
    const stored = closures.find((row) => row.id === period.id);
    const locked = findLockedPeriodForDate(d, closures, d);
    return {
      id: period.id,
      storeId: stored?.storeId || '',
      periodType: 'quarter',
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
      isClosed: Boolean(locked),
      history: stored?.history || [],
      createdAt: stored?.createdAt || new Date().toISOString(),
      updatedAt: stored?.updatedAt || new Date().toISOString(),
    };
  } catch {
    return closures.find((c) => dateInRange(d, c.startDate, c.endDate)) ?? null;
  }
}
