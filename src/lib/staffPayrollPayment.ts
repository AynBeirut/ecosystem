import {
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { glPostPayrollPayment } from '@/lib/platformGl';
import {
  resolvePaymentFrequency,
  type StaffPayrollRecord,
} from '@/lib/staffPayrollDisplay';
import type { SalaryPayment } from '@/types/staff';

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function computeHourlyPayAmount(hourlyRate: number | string, hours: number | string): number {
  const rate = Number(hourlyRate);
  const hourCount = Number(hours);
  if (!Number.isFinite(rate) || !Number.isFinite(hourCount) || rate < 0 || hourCount < 0) return 0;
  return round2(rate * hourCount);
}

export function computeDailyPayAmount(dailyRate: number | string, days: number | string): number {
  const rate = Number(dailyRate);
  const dayCount = Number(days);
  if (!Number.isFinite(rate) || !Number.isFinite(dayCount) || rate < 0 || dayCount < 0) return 0;
  return round2(rate * dayCount);
}

export function buildPayrollPaymentDocId(storeId: string, staffId: string, month: string): string {
  return `sp-${storeId}-${staffId}-${month}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 450);
}

export function defaultPayAmount(member: StaffPayrollRecord, month: string): number {
  const freq = resolvePaymentFrequency(member);
  if (freq === 'monthly') {
    return round2(Number(member.monthlySalary ?? member.salary ?? 0));
  }
  if (freq === 'daily') {
    return 0;
  }

  const summary = member.usbTimesheetSummary;
  if (!summary?.periods?.length) {
    return round2(Number(member.hourlyRate ?? member.salary ?? 0));
  }

  const year = month.slice(0, 4);
  const mm = month.slice(5, 7);
  const needles = [month, `${mm}/${year.slice(2)}`, `${mm}-${year}`, `/${mm}/`, `-${mm}-`];
  let periodTotal = 0;
  for (const period of summary.periods) {
    const blob = `${period.dateFrom || ''} ${period.dateTo || ''} ${period.sheetName || ''}`.toLowerCase();
    if (needles.some((needle) => blob.includes(String(needle).toLowerCase()))) {
      periodTotal += Number(period.totalPayUsd || 0);
    }
  }
  if (periodTotal > 0) return round2(periodTotal);
  return round2(Number(summary.totalPayUsd || 0));
}

export type ProcessStaffPayrollInput = {
  db: Firestore;
  storeId: string;
  staff: StaffPayrollRecord;
  month: string;
  baseAmount: number;
  transportAmount: number;
  hourlyRate?: number;
  hoursWorked?: number;
  dailyRate?: number;
  daysWorked?: number;
  paymentMethod?: 'cash' | 'bank';
  notes?: string;
  actor: { id: string; name: string; role: string };
  /** Replace an existing paid row for the same staff + month (corrections). */
  overwriteExisting?: boolean;
};

export type ProcessStaffPayrollResult = {
  paymentId: string;
  idempotentReplay: boolean;
  totalAmount: number;
};

export async function processStaffPayrollPayment(
  input: ProcessStaffPayrollInput,
): Promise<ProcessStaffPayrollResult> {
  const baseAmount = round2(Number(input.baseAmount) || 0);
  const transportAmount = round2(Number(input.transportAmount) || 0);
  const totalAmount = round2(baseAmount + transportAmount);

  if (totalAmount <= 0) {
    throw new Error('Pay amount plus transport must be greater than zero.');
  }

  const staffId = String(input.staff.id || '').trim();
  const staffName = String(input.staff.name || input.staff.staffName || 'Employee').trim();
  const paymentId = buildPayrollPaymentDocId(input.storeId, staffId, input.month);
  const paymentRef = doc(input.db, 'salaryPayments', paymentId);

  const existingSnap = await getDoc(paymentRef);
  if (existingSnap.exists()) {
    const existing = existingSnap.data();
    if (existing?.status === 'paid' && !input.overwriteExisting) {
      return {
        paymentId,
        idempotentReplay: true,
        totalAmount: round2(Number(existing.totalAmount || totalAmount)),
      };
    }
  }

  const paymentDate = new Date().toISOString();
  const paymentMethod = input.paymentMethod || 'cash';

  const paymentData: SalaryPayment = {
    id: paymentId,
    staffId,
    staffName,
    salaryId: staffId,
    month: input.month,
    paymentDate,
    baseSalary: baseAmount,
    commission: 0,
    bonus: 0,
    deductions: 0,
    transportAmount,
    hourlyRate: input.hourlyRate != null && input.hourlyRate > 0 ? round2(input.hourlyRate) : undefined,
    hoursWorked: input.hoursWorked != null && input.hoursWorked > 0 ? round2(input.hoursWorked) : undefined,
    dailyRate: input.dailyRate != null && input.dailyRate > 0 ? round2(input.dailyRate) : undefined,
    daysWorked: input.daysWorked != null && input.daysWorked > 0 ? round2(input.daysWorked) : undefined,
    totalAmount,
    paymentMethod,
    notes: input.notes || '',
    status: 'paid',
    storeId: input.storeId,
    createdAt: paymentDate,
    idempotencyKey: `${staffId}:${input.month}`,
  };

  await setDoc(paymentRef, paymentData);

  await glPostPayrollPayment(input.storeId, {
    id: paymentId,
    staffId,
    staffName,
    paymentDate,
    paymentMethod,
    baseAmount,
    transportAmount,
    commissionAmount: 0,
    bonusAmount: 0,
    deductions: 0,
    totalAmount,
  });

  return { paymentId, idempotentReplay: false, totalAmount };
}

export function isStaffPaidForMonth(
  payments: SalaryPayment[],
  staffId: string,
  month: string,
): boolean {
  return Boolean(getStaffPaymentForMonth(payments, staffId, month));
}

export function getStaffPaymentForMonth(
  payments: SalaryPayment[],
  staffId: string,
  month: string,
): SalaryPayment | undefined {
  return payments.find((payment) => {
    if (payment.staffId !== staffId || payment.month !== month) return false;
    if (payment.status && payment.status !== 'paid') return false;
    const id = String(payment.id || '');
    if (id.startsWith('sp-') || payment.idempotencyKey) return true;
    return false;
  });
}

export function paymentsForStaffMember(
  payments: SalaryPayment[],
  staffId: string,
): SalaryPayment[] {
  return payments
    .filter(
      (payment) =>
        payment.staffId === staffId && (payment.status === 'paid' || !payment.status),
    )
    .sort((a, b) => {
      const monthCmp = String(b.month || '').localeCompare(String(a.month || ''));
      if (monthCmp !== 0) return monthCmp;
      return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
    });
}

export function formatPayrollPaymentDetail(payment: SalaryPayment): string {
  if (payment.hoursWorked && payment.hourlyRate) {
    return `${Number(payment.hoursWorked).toFixed(2)} hrs × $${Number(payment.hourlyRate).toFixed(2)}`;
  }
  if (payment.daysWorked && payment.dailyRate) {
    return `${Number(payment.daysWorked).toFixed(0)} days × $${Number(payment.dailyRate).toFixed(2)}`;
  }
  if (Number(payment.baseSalary || 0) > 0) {
    return `Base $${Number(payment.baseSalary).toFixed(2)}`;
  }
  return 'Payroll';
}
