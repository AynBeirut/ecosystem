export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'internet', label: 'Internet' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'office_supplies', label: 'Office supplies' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal', label: 'Legal & professional' },
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals & entertainment' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHODS = ['cash', 'bank', 'card', 'omt', 'wish'] as const;
