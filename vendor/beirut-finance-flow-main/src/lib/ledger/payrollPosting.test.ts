import { describe, expect, it } from 'vitest';
import { PAYROLL_EXPENSE_PCG } from '@/lib/ledger/employeeSubaccountCodes';
import { isPayrollExpenseLike, splitPayrollComponents } from '@/lib/ledger/payrollPosting';

describe('payrollPosting', () => {
  it('detects payroll-like expenses to skip duplicate GL', () => {
    expect(isPayrollExpenseLike({ category: 'payroll' })).toBe(true);
    expect(isPayrollExpenseLike({ description: 'Salary Payment: John' })).toBe(true);
    expect(isPayrollExpenseLike({ linkedStaffId: 'staff-1' })).toBe(true);
    expect(isPayrollExpenseLike({ category: 'utilities', description: 'Electric bill' })).toBe(false);
  });

  it('splits pay, transport, bonus, cnss into PCG expense buckets', () => {
    const rows = splitPayrollComponents({
      id: 'p1',
      paymentDate: '2026-01-01',
      baseAmount: 1000,
      transportAmount: 50,
      bonusAmount: 100,
      cnssAmount: 25,
      totalAmount: 1175,
    });
    expect(rows).toEqual([
      { kind: 'pay', amount: 1000 },
      { kind: 'transport', amount: 50 },
      { kind: 'bonus', amount: 100 },
      { kind: 'cnss', amount: 25 },
    ]);
    expect(PAYROLL_EXPENSE_PCG.pay).toBe('6311');
    expect(PAYROLL_EXPENSE_PCG.transport).toBe('6319.1');
    expect(PAYROLL_EXPENSE_PCG.cnss).toBe('6351');
  });
});
