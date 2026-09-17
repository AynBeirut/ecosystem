/** Payroll rows on Staff page — financeExpenses with payroll surface/category. */

export function isPayrollExpenseListRow(row: Record<string, unknown>): boolean {
  const surface = String(row.expenseUiSurface || row.uiSurface || '').toLowerCase();
  if (surface === 'payroll') return true;
  const category = String(row.organizedCategory || row.category || '').toLowerCase();
  return category === 'payroll' || category === 'wages';
}
