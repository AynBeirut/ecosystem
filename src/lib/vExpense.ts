import { doc, getFirestore, setDoc } from 'firebase/firestore';

export type VExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'fuel'
  | 'internet'
  | 'maintenance'
  | 'office_supplies'
  | 'marketing'
  | 'insurance'
  | 'legal'
  | 'travel'
  | 'meals'
  | 'payroll'
  | 'other';

export type CreateVExpenseInput = {
  storeId: string;
  name: string;
  amount: number;
  category: VExpenseCategory;
  paymentMethod?: 'cash' | 'bank' | 'card' | 'other';
  notes?: string;
  date?: string;
};

/** Writes one expense into the Invoice Manager store collection (same as ExpenseManager). */
export async function createVExpense(input: CreateVExpenseInput): Promise<{ id: string }> {
  if (!input.storeId) throw new Error('Missing store');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid amount');

  const id = `EXP-${Date.now()}`;
  const now = new Date().toISOString();
  const startDate = input.date || now.slice(0, 10);

  const expense = {
    id,
    name: input.name.trim() || 'Expense',
    description: '',
    category: input.category,
    type: 'one-time' as const,
    amount,
    startDate,
    paymentMethod: input.paymentMethod || 'cash',
    status: 'unpaid' as const,
    notes: input.notes || '',
    storeId: input.storeId,
    createdAt: now,
    updatedAt: now,
    source: 'v-expense',
  };

  const db = getFirestore();
  await setDoc(doc(db, 'stores', input.storeId, 'financeExpenses', id), expense);
  return { id };
}

export const V_EXPENSE_CATEGORIES: Array<{ id: VExpenseCategory; label: string }> = [
  { id: 'rent', label: 'Rent' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'internet', label: 'Internet' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'office_supplies', label: 'Supplies' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'meals', label: 'Meals' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'travel', label: 'Travel' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'other', label: 'Other' },
];
