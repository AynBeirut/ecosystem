import {
  buildPayrollRoster,
  canonicalPayrollStaffKey,
  type StaffPayrollRecord,
} from '@/lib/staffPayrollDisplay';
import type { SalaryPayment } from '@/types/staff';

export type NormalizedSalaryPayment = SalaryPayment & {
  month: string;
  totalAmount: number;
  baseSalary: number;
  commissionAmount: number;
  bonus: number;
  matchedStaffId?: string;
};

function round2(n: number) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Mark-as-paid rows from Admin Salaries (`sp-{store}-{staff}-{month}`). Excludes legacy POS salary noise. */
export function isGrabioPayrollPayment(
  payment: Pick<SalaryPayment, 'id'> & { idempotencyKey?: string },
): boolean {
  const id = String(payment.id || '');
  if (id.startsWith('sp-')) return true;
  if (payment.idempotencyKey && String(payment.idempotencyKey).includes(':')) return true;
  return false;
}

function parseMonthFromDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** POS rows: "2025-12-31 to 2026-01-30" → pay period end month. */
function parseMonthFromPaymentPeriod(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).match(/(\d{4}-\d{2}-\d{2})\s*$/);
  if (!match) return null;
  return parseMonthFromDate(match[1]);
}

export function normalizeSalaryPayment(raw: SalaryPayment): NormalizedSalaryPayment {
  const month =
    raw.month ||
    parseMonthFromPaymentPeriod((raw as { paymentPeriod?: string }).paymentPeriod) ||
    parseMonthFromDate(raw.paymentDate) ||
    '';

  const totalAmount = round2(
    Number(
      raw.totalAmount ??
        (raw as { netAmount?: number }).netAmount ??
        (raw as { amount?: number }).amount ??
        0,
    ),
  );

  const baseSalary = round2(
    Number(raw.baseSalary ?? (raw as { baseAmount?: number }).baseAmount ?? 0),
  );

  const commissionAmount = round2(
    Number(raw.commissionAmount ?? raw.commission ?? 0),
  );

  const bonus = round2(Number(raw.bonus ?? (raw as { bonusAmount?: number }).bonusAmount ?? 0));

  return {
    ...raw,
    month,
    totalAmount,
    baseSalary,
    commissionAmount,
    bonus,
    commission: commissionAmount,
  };
}

function staffLookupMaps(roster: StaffPayrollRecord[]) {
  const byDocId = new Map<string, StaffPayrollRecord>();
  const byLocalId = new Map<string, StaffPayrollRecord>();
  const byCanonical = new Map<string, StaffPayrollRecord>();

  for (const member of roster) {
    byDocId.set(member.id, member);
    if (member.localId) byLocalId.set(String(member.localId), member);
    byCanonical.set(canonicalPayrollStaffKey(member), member);
  }

  return { byDocId, byLocalId, byCanonical };
}

export function matchPaymentToStaffId(
  payment: Pick<SalaryPayment, 'staffId' | 'staffName'>,
  roster: StaffPayrollRecord[],
): string | undefined {
  const { byDocId, byLocalId, byCanonical } = staffLookupMaps(roster);
  const rawStaffId = String(payment.staffId || '').trim();
  if (rawStaffId && byDocId.has(rawStaffId)) return rawStaffId;
  if (rawStaffId && byLocalId.has(rawStaffId)) return byLocalId.get(rawStaffId)!.id;

  const name = String(payment.staffName || '').trim().toLowerCase();
  if (name) {
    for (const member of roster) {
      const memberName = String(member.name || member.staffName || '').trim().toLowerCase();
      if (memberName && (memberName === name || memberName.includes(name) || name.includes(memberName))) {
        return member.id;
      }
    }
  }

  if (rawStaffId && byCanonical.has(rawStaffId)) return byCanonical.get(rawStaffId)!.id;
  return undefined;
}

export function normalizeStoreSalaryPayments(
  rawPayments: SalaryPayment[],
  rosterInput: StaffPayrollRecord[],
): NormalizedSalaryPayment[] {
  const roster = buildPayrollRoster(rosterInput);
  return rawPayments.map((raw) => {
    const normalized = normalizeSalaryPayment(raw);
    const matchedStaffId = matchPaymentToStaffId(normalized, roster);
    return matchedStaffId ? { ...normalized, matchedStaffId } : normalized;
  });
}

export function paymentsForStaffMember(
  payments: NormalizedSalaryPayment[],
  staffId: string,
): NormalizedSalaryPayment[] {
  return payments.filter(
    (payment) =>
      isGrabioPayrollPayment(payment) &&
      (payment.staffId === staffId || payment.matchedStaffId === staffId),
  );
}

export function paymentsForMonth(
  payments: NormalizedSalaryPayment[],
  month: string,
): NormalizedSalaryPayment[] {
  return payments.filter(
    (payment) => payment.month === month && isGrabioPayrollPayment(payment),
  );
}

export function sumPaymentTotals(payments: NormalizedSalaryPayment[]): {
  count: number;
  totalPaid: number;
  totalCommissions: number;
  totalBaseSalaries: number;
} {
  return payments.reduce(
    (acc, payment) => ({
      count: acc.count + 1,
      totalPaid: acc.totalPaid + Number(payment.totalAmount || 0),
      totalCommissions: acc.totalCommissions + Number(payment.commissionAmount || 0),
      totalBaseSalaries: acc.totalBaseSalaries + Number(payment.baseSalary || 0),
    }),
    { count: 0, totalPaid: 0, totalCommissions: 0, totalBaseSalaries: 0 },
  );
}
