import { GL_ACCOUNT_CODES } from './defaultChartOfAccounts';

export const EMPLOYEE_PARENT_GRABIO = '142';
export const EMPLOYEE_PARENT_PCG = '4281';
export const EMPLOYEE_SUFFIX_DIGITS = 4;

export type PayrollComponentKind = 'pay' | 'transport' | 'commission' | 'bonus' | 'cnss' | 'other';

export const PAYROLL_COMPONENT_LABEL: Record<PayrollComponentKind, string> = {
  pay: 'Pay',
  transport: 'Transport',
  commission: 'Commission',
  bonus: 'Bonus',
  cnss: 'CNSS',
  other: 'Other',
};

export const PAYROLL_EXPENSE_PCG: Record<PayrollComponentKind, string> = {
  pay: '6311',
  transport: '6319.1',
  commission: '6314',
  bonus: '6319.9',
  cnss: '6351',
  other: '6319.9',
};

export const PAYROLL_EXPENSE_GRABIO: Record<PayrollComponentKind, string> = {
  pay: GL_ACCOUNT_CODES.PAYROLL,
  transport: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  commission: GL_ACCOUNT_CODES.PAYROLL,
  bonus: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
  cnss: '602',
  other: GL_ACCOUNT_CODES.GENERAL_EXPENSE,
};

export function employeePartyKey(staffId: string, component: PayrollComponentKind): string {
  return `${String(staffId || '').trim()}:${component}`;
}
