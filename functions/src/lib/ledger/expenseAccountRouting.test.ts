import { describe, expect, it } from 'vitest';
import { resolveExpenseAccountCode } from './expenseAccountRouting';
import { GL_ACCOUNT_CODES } from './defaultChartOfAccounts';

describe('resolveExpenseAccountCode', () => {
  it('maps POS bill payment groceries to COGS', () => {
    expect(
      resolveExpenseAccountCode({
        category: 'Bill Payment',
        vendor: 'Spinneys - Elisar Branch',
        description: 'Bill #123',
      }),
    ).toBe(GL_ACCOUNT_CODES.COGS);
  });

  it('maps bill payment EDL to utilities', () => {
    expect(
      resolveExpenseAccountCode({
        category: 'Bill Payment',
        vendor: 'EDL',
      }),
    ).toBe(GL_ACCOUNT_CODES.UTILITIES);
  });

  it('maps staff_wages to payroll', () => {
    expect(resolveExpenseAccountCode({ category: 'staff_wages' })).toBe(GL_ACCOUNT_CODES.PAYROLL);
  });

  it('keeps unknown categories on miscellaneous', () => {
    expect(resolveExpenseAccountCode({ category: 'marketing' })).toBe(GL_ACCOUNT_CODES.GENERAL_EXPENSE);
  });
});
