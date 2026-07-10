export type PeriodLockType = 'month' | 'quarter';

export type PeriodLockAuditEvent = {
  action: 'close' | 'reopen';
  at: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  reason?: string;
};

export type LedgerPeriodClosure = {
  id: string;
  storeId: string;
  periodType: PeriodLockType;
  startDate: string;
  endDate: string;
  label: string;
  isClosed: boolean;
  history: PeriodLockAuditEvent[];
  createdAt: string;
  updatedAt: string;
};

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

export function normalizeJournalDate(dateIso: string): string {
  const d = new Date(dateIso);
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

function lastDayOfMonth(year: number, month: number): number {
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
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const id = periodIdForQuarter(year, quarter);
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDay = lastDayOfMonth(year, endMonth);
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  return {
    id,
    periodType: 'quarter' as PeriodLockType,
    startDate,
    endDate,
    label: `Q${quarter} ${year}`,
  };
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
): void {
  const closed = findClosedPeriodForDate(dateIso, closures);
  if (closed) {
    throw new PeriodLockedError(
      `Period ${closed.label} is closed — cannot ${action} dated ${normalizeJournalDate(dateIso)}.`,
      closed.id,
    );
  }
}
