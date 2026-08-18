import { describe, expect, it } from 'vitest';
import {
  buildQuarterPeriod,
  findLockedPeriodForDate,
  isQuarterAutoClosed,
  journalDateOnly,
  listQuartersNeedingAutoClose,
  normalizeJournalDate,
  parseJournalDateInput,
  resolveFiscalQuarterForDate,
} from '@/lib/ledger/periodLockCore';

describe('periodLockCore journal dates', () => {
  it('accepts far-future voucher dates like 2036-07-16', () => {
    expect(parseJournalDateInput('2036-07-16')).toBe('2036-07-16T12:00:00.000Z');
    expect(journalDateOnly('2036-07-16')).toBe('2036-07-16');
    expect(normalizeJournalDate('2036-07-16')).toBe('2036-07-16');
  });

  it('accepts backdated entries in 2026', () => {
    expect(journalDateOnly('2026-07-16')).toBe('2026-07-16');
  });
});

describe('fiscal quarter auto-close', () => {
  it('uses 30th-based quarter boundaries', () => {
    expect(buildQuarterPeriod(2026, 1)).toMatchObject({
      startDate: '2026-01-01',
      endDate: '2026-03-30',
    });
    expect(buildQuarterPeriod(2026, 4)).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-12-30',
    });
  });

  it('auto-closes Q1 after 30 Mar', () => {
    const q1 = buildQuarterPeriod(2026, 1);
    expect(isQuarterAutoClosed(q1.endDate, '2026-03-30')).toBe(false);
    expect(isQuarterAutoClosed(q1.endDate, '2026-03-31')).toBe(true);
    expect(findLockedPeriodForDate('2026-03-15', [], '2026-08-16')?.id).toBe('2026-Q1');
    expect(findLockedPeriodForDate('2026-07-16', [], '2026-08-16')).toBeNull();
  });

  it('lists expired quarters for auto-close writes', () => {
    const due = listQuartersNeedingAutoClose('2026-08-16', [], 2026, 2026);
    expect(due).toEqual([
      { year: 2026, quarter: 1 },
      { year: 2026, quarter: 2 },
    ]);
  });

  it('resolves fiscal quarter for a journal date', () => {
    expect(resolveFiscalQuarterForDate('2026-04-15')).toEqual({ year: 2026, quarter: 2 });
    expect(resolveFiscalQuarterForDate('2026-09-20')).toEqual({ year: 2026, quarter: 3 });
  });
});
