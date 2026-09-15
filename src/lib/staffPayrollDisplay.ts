import type { PaymentFrequency, StaffMember, StaffStatus } from '@/types/staff';

export type UsbTimesheetShift = {
  date?: string;
  regularHours?: number;
  hourlyRateUsd?: number;
  transportUsd?: number;
  totalUsd?: number;
};

export type UsbTimesheetPeriod = {
  sheetName?: string;
  dateFrom?: string;
  dateTo?: string;
  payMonth?: string;
  totalPayUsd?: number;
  shiftCount?: number;
  hourlyRateUsd?: number;
  sourceFile?: string;
  shifts?: UsbTimesheetShift[];
};

export type UsbTimesheetSummary = {
  totalPayUsd?: number;
  shiftCount?: number;
  periods?: UsbTimesheetPeriod[];
  sourceFiles?: string[];
};

export type StaffPayrollRecord = StaffMember & {
  paymentType?: 'hourly' | 'monthly' | string;
  paymentFrequency?: PaymentFrequency | string;
  payBasis?: string;
  hourlyRate?: number;
  monthlySalary?: number;
  isActive?: boolean;
  localId?: string;
  staffName?: string;
  position?: string;
  department?: string;
  importSource?: string;
  usbTimesheetSummary?: UsbTimesheetSummary;
};

function normalizeName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function statementMatchTokens(member: StaffPayrollRecord): string[] {
  const tokens = new Set<string>();
  const add = (value?: string | null) => {
    const norm = normalizeName(value);
    if (!norm) return;
    tokens.add(norm);
    const first = norm.split(' ')[0];
    if (first && first.length >= 3) tokens.add(first);
  };
  add(member.name);
  add(member.staffName);
  if (member.localId) add(String(member.localId).replace(/-/g, ' '));
  return [...tokens];
}

function periodBelongsToMember(period: UsbTimesheetPeriod, tokens: string[]): boolean {
  const sheet = normalizeName(period.sheetName);
  if (!sheet) return false;
  return tokens.some((token) => {
    if (sheet === token) return true;
    if (token.length >= 4 && sheet.includes(token)) return true;
    if (sheet.length >= 4 && token.includes(sheet)) return true;
    return false;
  });
}

function periodQuality(period: UsbTimesheetPeriod): number {
  const source = String(period.sourceFile || '').toLowerCase();
  const extScore = source.endsWith('.xlsx') ? 2 : source.endsWith('.xls') ? 1 : 0;
  const shiftCount = Number(period.shiftCount || 0);
  const totalPay = Number(period.totalPayUsd || 0);
  return (shiftCount > 0 ? 1000 : 0) + shiftCount * 10 + totalPay + extScore;
}

function dedupeStatementPeriods(periods: UsbTimesheetPeriod[]): UsbTimesheetPeriod[] {
  const byKey = new Map<string, UsbTimesheetPeriod>();
  for (const period of periods) {
    const key =
      period.payMonth ||
      `${period.dateFrom}|${period.dateTo}|${normalizeName(period.sheetName)}`;
    const existing = byKey.get(key);
    if (!existing || periodQuality(period) > periodQuality(existing)) {
      byKey.set(key, period);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    String(a.payMonth || a.dateFrom || '').localeCompare(String(b.payMonth || b.dateFrom || '')),
  );
}

/** USB Excel sometimes lands multiple employees' sheet rows on one staff doc — keep only this person. */
export function filterStatementPeriodsForMember(
  member: StaffPayrollRecord,
  periods: UsbTimesheetPeriod[],
): UsbTimesheetPeriod[] {
  const tokens = statementMatchTokens(member);
  const matched = periods.filter((period) => periodBelongsToMember(period, tokens));
  return dedupeStatementPeriods(matched);
}

export function summarizeStatementPeriods(periods: UsbTimesheetPeriod[]): {
  shiftCount: number;
  totalPayUsd: number;
} {
  return periods.reduce(
    (acc, period) => ({
      shiftCount: acc.shiftCount + Number(period.shiftCount || 0),
      totalPayUsd: Math.round((acc.totalPayUsd + Number(period.totalPayUsd || 0) + Number.EPSILON) * 100) / 100,
    }),
    { shiftCount: 0, totalPayUsd: 0 },
  );
}

export function statementPeriodKey(period: UsbTimesheetPeriod, index = 0): string {
  return (
    period.payMonth ||
    [period.dateFrom, period.dateTo, period.sheetName, index].filter(Boolean).join('|')
  );
}

export function sortUsbShifts(shifts: UsbTimesheetShift[] = []): UsbTimesheetShift[] {
  return [...shifts].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function scoreStaffRecord(member: StaffPayrollRecord): number {
  let score = 0;
  if (String(member.id || '').startsWith('usb-')) score += 100;
  if (member.usbTimesheetSummary?.periods?.length) score += 40;
  if (member.status === 'active' || member.isActive !== false) score += 10;
  if (Number(member.salary || member.hourlyRate || member.monthlySalary || 0) > 0) score += 5;
  if (Number(member.usbTimesheetSummary?.totalPayUsd || 0) > 0) score += 5;
  return score;
}

export function canonicalPayrollStaffKey(member: StaffPayrollRecord): string {
  if (member.localId) return String(member.localId);
  const id = String(member.id || '');
  const usbPrefix = id.match(/^usb-[^-]+-(.+)$/);
  if (usbPrefix?.[1]) return usbPrefix[1];
  return normalizeName(member.name || member.staffName || `${member.id}`);
}

function staffDisplayName(member: StaffPayrollRecord): string {
  return String(member.name || member.staffName || '').trim();
}

function namesLikelySamePerson(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

function hasUsbPayrollMatch(allStaff: StaffPayrollRecord[], member: StaffPayrollRecord): boolean {
  const name = staffDisplayName(member);
  if (!name) return false;
  return allStaff.some((candidate) => {
    if (!String(candidate.id || '').startsWith('usb-')) return false;
    return namesLikelySamePerson(name, staffDisplayName(candidate));
  });
}

function isPayrollCandidate(member: StaffPayrollRecord, allStaff: StaffPayrollRecord[]): boolean {
  if (isExcludedFromPayrollRoster(member)) return false;
  const id = String(member.id || '');
  if (id.startsWith('usb-')) return true;
  if (id.startsWith('pos-')) {
    if (!staffDisplayName(member)) return false;
    return !hasUsbPayrollMatch(allStaff, member);
  }
  return Boolean(staffDisplayName(member));
}

/** One row per employee — prefer USB Excel import over duplicate POS rows. */
export function buildPayrollRoster(allStaff: StaffPayrollRecord[]): StaffPayrollRecord[] {
  const candidates = allStaff.filter((member) => isPayrollCandidate(member, allStaff));
  const byKey = new Map<string, StaffPayrollRecord>();
  const ranked = [...candidates].sort((a, b) => scoreStaffRecord(b) - scoreStaffRecord(a));
  for (const member of ranked) {
    const key = canonicalPayrollStaffKey(member);
    if (!key || key === 'unknown') continue;
    if (!byKey.has(key)) byKey.set(key, member);
  }
  return [...byKey.values()].sort((a, b) =>
    staffDisplayName(a).localeCompare(staffDisplayName(b)),
  );
}

export function resolvePaymentFrequency(member: StaffPayrollRecord): PaymentFrequency {
  const raw = String(member.paymentFrequency || member.paymentType || member.payBasis || 'monthly').toLowerCase();
  if (raw === 'hourly' || raw === 'daily' || raw === 'monthly') return raw;
  return 'monthly';
}

export function formatStaffPayLine(member: StaffPayrollRecord): string {
  const freq = resolvePaymentFrequency(member);
  if (freq === 'hourly') {
    const rate = Number(member.hourlyRate ?? member.salary ?? 0);
    return `$${rate.toFixed(2)}/hr`;
  }
  if (freq === 'daily') {
    const rate = Number(member.salary ?? member.hourlyRate ?? 0);
    return `$${rate.toFixed(2)}/day`;
  }
  const rate = Number(member.monthlySalary ?? member.salary ?? 0);
  return `$${rate.toFixed(2)}/mo`;
}

export function formatStaffRoleLabel(member: StaffPayrollRecord): string {
  const raw = member.position || member.department || member.role;
  if (!raw) return 'Employee';
  if (raw === 'sales_person') return 'Sales';
  if (raw === 'employee') return 'Employee';
  if (raw === 'supervisor') return 'Supervisor';
  if (raw === 'cashier') return 'Cashier';
  return String(raw);
}

export function resolveStaffStatus(member: StaffPayrollRecord): StaffStatus {
  const raw = String(member.status || '').toLowerCase();
  if (raw === 'active' || raw === 'suspended' || raw === 'terminated') {
    return raw as StaffStatus;
  }
  // Legacy / UI label "inactive" → treat as suspended (can re-activate)
  if (raw === 'inactive') return 'suspended';
  if (member.isActive === false) return 'terminated';
  return 'active';
}

/** True when the person can be returned to the active payroll roster. */
export function canReactivateStaff(member: StaffPayrollRecord): boolean {
  return resolveStaffStatus(member) !== 'active';
}

export function getUsbTimesheetSummary(member: StaffPayrollRecord): UsbTimesheetSummary | null {
  if (member.usbTimesheetSummary) return member.usbTimesheetSummary;
  return null;
}

export function hasPayrollStatement(member: StaffPayrollRecord): boolean {
  return Boolean(
    getUsbTimesheetSummary(member)?.periods?.length
      || getUsbTimesheetSummary(member)?.totalPayUsd
      || member.importSource?.includes('littlehands-usb'),
  );
}

export function partitionPayrollRoster(allStaff: StaffPayrollRecord[]): {
  hourly: StaffPayrollRecord[];
  monthly: StaffPayrollRecord[];
} {
  const roster = buildPayrollRoster(allStaff);
  const hourly: StaffPayrollRecord[] = [];
  const monthly: StaffPayrollRecord[] = [];
  for (const member of roster) {
    if (resolvePaymentFrequency(member) === 'hourly') hourly.push(member);
    else monthly.push(member);
  }
  return { hourly, monthly };
}

function compareStaffByDisplayName(a: StaffPayrollRecord, b: StaffPayrollRecord): number {
  const nameA = (a.name || a.staffName || '').trim();
  const nameB = (b.name || b.staffName || '').trim();
  return nameA.localeCompare(nameB);
}

/** Active first (A–Z); terminated/suspended grouped at the bottom (A–Z). */
export function partitionStaffByEmploymentStatus(roster: StaffPayrollRecord[]): {
  active: StaffPayrollRecord[];
  inactive: StaffPayrollRecord[];
} {
  const active: StaffPayrollRecord[] = [];
  const inactive: StaffPayrollRecord[] = [];
  for (const member of roster) {
    if (resolveStaffStatus(member) === 'active') active.push(member);
    else inactive.push(member);
  }
  active.sort(compareStaffByDisplayName);
  inactive.sort(compareStaffByDisplayName);
  return { active, inactive };
}

export function resolveHourlyRate(member: StaffPayrollRecord): number {
  const fromMember = Number(member.hourlyRate ?? member.salary ?? 0);
  if (fromMember > 0) return fromMember;

  const summary = getUsbTimesheetSummary(member);
  const ownPeriods = filterStatementPeriodsForMember(member, summary?.periods || []);
  for (const period of ownPeriods) {
    const rate = Number(period.hourlyRateUsd ?? 0);
    if (rate > 0) return rate;
  }
  return 0;
}

/** Daily wage from staff profile (`salary` field stores per-day rate for daily employees). */
export function resolveDailyRate(member: StaffPayrollRecord): number {
  if (resolvePaymentFrequency(member) !== 'daily') return 0;
  const fromSalary = Number(member.salary ?? 0);
  if (fromSalary > 0) return fromSalary;
  return Number(member.hourlyRate ?? 0);
}

/** USB test import rows — hide from payroll roster (e.g. duplicate Chris sheet). */
export function isExcludedFromPayrollRoster(member: StaffPayrollRecord): boolean {
  if ((member as { payrollExcluded?: boolean }).payrollExcluded === true) return true;
  const localId = String(member.localId || '').toLowerCase();
  const src = String(member.importSource || '').toLowerCase();
  if (localId === 'chris' && src.includes('littlehands-usb-staff:chris')) return true;
  return false;
}

/** Amount due for a calendar month from USB Excel / monthly profile (before transport). */
export function resolveMonthPayrollDue(member: StaffPayrollRecord, month: string): number {
  const freq = resolvePaymentFrequency(member);
  if (freq === 'hourly') {
    return hourlyMonthSummary(member, month).payUsd;
  }
  if (freq === 'daily') {
    return 0;
  }
  const monthly = Number(member.monthlySalary ?? member.salary ?? 0);
  if (monthly > 0) return Math.round((monthly + Number.EPSILON) * 100) / 100;
  return 0;
}

export function hourlyMonthSummary(
  member: StaffPayrollRecord,
  month: string,
): {
  shiftCount: number;
  payUsd: number;
  hasExcelData: boolean;
  totalHours: number;
  hourlyRateUsd: number;
} {
  const hourlyRateUsd = resolveHourlyRate(member);
  const summary = getUsbTimesheetSummary(member);
  const periods = filterStatementPeriodsForMember(member, summary?.periods || []);
  if (!periods.length) {
    return { shiftCount: 0, payUsd: 0, hasExcelData: false, totalHours: 0, hourlyRateUsd };
  }

  const year = month.slice(0, 4);
  const mm = month.slice(5, 7);
  const needles = [month, `${mm}/${year.slice(2)}`, `${mm}-${year}`, `/${mm}/`, `-${mm}-`];
  let shiftCount = 0;
  let payUsd = 0;
  let matched = false;

  for (const period of periods) {
    if (period.payMonth === month) {
      matched = true;
      shiftCount += Number(period.shiftCount || 0);
      payUsd += Number(period.totalPayUsd || 0);
      continue;
    }
    const blob = `${period.dateFrom || ''} ${period.dateTo || ''} ${period.sheetName || ''}`.toLowerCase();
    if (needles.some((needle) => blob.includes(String(needle).toLowerCase()))) {
      matched = true;
      shiftCount += Number(period.shiftCount || 0);
      payUsd += Number(period.totalPayUsd || 0);
    }
  }

  if (!matched && periods.length === 1) {
    shiftCount = Number(periods[0].shiftCount || 0);
    payUsd = Number(periods[0].totalPayUsd || 0);
    matched = shiftCount > 0 || payUsd > 0;
  }

  payUsd = Math.round((payUsd + Number.EPSILON) * 100) / 100;
  const totalHours =
    payUsd > 0 && hourlyRateUsd > 0
      ? Math.round((payUsd / hourlyRateUsd + Number.EPSILON) * 100) / 100
      : 0;

  return {
    shiftCount,
    payUsd,
    hasExcelData: matched || Number(summary.shiftCount || 0) > 0,
    totalHours,
    hourlyRateUsd,
  };
}

export function formatTimesheetTotals(member: StaffPayrollRecord, month?: string): string | null {
  const freq = resolvePaymentFrequency(member);
  if (freq === 'hourly' && month) {
    const monthStats = hourlyMonthSummary(member, month);
    if (monthStats.hasExcelData || monthStats.shiftCount > 0 || monthStats.payUsd > 0) {
      return `${monthStats.shiftCount} shift${monthStats.shiftCount === 1 ? '' : 's'} · $${monthStats.payUsd.toFixed(2)} for ${month}`;
    }
  }

  const summary = getUsbTimesheetSummary(member);
  if (!summary) {
    return freq === 'hourly' ? 'Hourly — no Excel shifts yet' : null;
  }
  const shifts = Number(summary.shiftCount || 0);
  const total = Number(summary.totalPayUsd || 0);
  if (freq === 'hourly') {
    return `${shifts} shift${shifts === 1 ? '' : 's'} · $${total.toFixed(2)} Excel total`;
  }
  if (!shifts && !total) return null;
  return `${shifts} shift${shifts === 1 ? '' : 's'} · $${total.toFixed(2)} Excel total`;
}

/** Cash-book / payroll line is a salary advance (not regular wage). */
export function isPayrollAdvanceDescription(...parts: Array<string | undefined | null>): boolean {
  const t = parts.filter(Boolean).join(' ').toLowerCase();
  return t.includes('advance') || t.includes('salairy');
}
