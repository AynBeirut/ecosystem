import type {
  CashBalance,
  CashCollection,
  CashTransaction,
  DeliveryOrder,
  DeliveryPerson,
  Expense,
  ExpenseEntry,
  Staff,
  StaffPayment,
} from '@/types/accounting';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import {
  listStoreCollection,
  loadCashBalance,
  replaceStoreCollection,
  saveCashBalance,
} from './storeCollection';

export type AccountingFirestoreData = {
  expenses: Expense[];
  expenseEntries: ExpenseEntry[];
  staff: Staff[];
  staffPayments: StaffPayment[];
  deliveryPersons: DeliveryPerson[];
  deliveryOrders: DeliveryOrder[];
  cashCollections: CashCollection[];
  cashBalance: CashBalance | null;
  cashTransactions: CashTransaction[];
};

const DEFAULT_CASH_BALANCE: CashBalance = {
  cashOnHand: 0,
  bankBalance: 0,
  deliveryHeldCash: 0,
  outstandingClientBalances: 0,
  lastUpdated: new Date().toISOString(),
};

function parsePaymentPeriod(raw: unknown): { periodStart: string; periodEnd: string } {
  const text = String(raw || '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
  if (match) {
    return {
      periodStart: new Date(`${match[1]}T00:00:00.000Z`).toISOString(),
      periodEnd: new Date(`${match[2]}T00:00:00.000Z`).toISOString(),
    };
  }
  const now = new Date().toISOString();
  return { periodStart: now, periodEnd: now };
}

const EXPENSE_CATEGORY_KEYS: Expense['category'][] = [
  'rent',
  'utilities',
  'fuel',
  'internet',
  'maintenance',
  'office_supplies',
  'marketing',
  'insurance',
  'legal',
  'travel',
  'meals',
  'payroll',
  'other',
];

function mapFinanceExpenseCategory(raw: Record<string, unknown>): Expense['category'] {
  const rawCat = String(raw.category || raw.organizedCategory || 'other')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if ((EXPENSE_CATEGORY_KEYS as string[]).includes(rawCat)) return rawCat as Expense['category'];
  if (rawCat.includes('payroll') || rawCat === 'payroll') return 'payroll';
  if (rawCat.includes('rent')) return 'rent';
  if (rawCat.includes('utilit')) return 'utilities';
  if (rawCat.includes('fuel')) return 'fuel';
  return 'other';
}

function normalizeFinanceExpense(raw: Record<string, unknown> & { id: string }): Expense {
  const amount = Number(raw.amount ?? 0);
  const paidRaw = raw.paidAmount;
  const statusRaw = String(raw.status || '').toLowerCase();
  let status: Expense['status'] =
    statusRaw === 'paid' || statusRaw === 'partial' || statusRaw === 'unpaid'
      ? (statusRaw as Expense['status'])
      : amount > 0
        ? 'paid'
        : 'unpaid';
  let paidAmount = Number(paidRaw);
  if (!Number.isFinite(paidAmount)) {
    paidAmount = status === 'paid' ? amount : status === 'partial' ? 0 : 0;
  }
  if (status === 'paid' && paidAmount <= 0 && amount > 0) paidAmount = amount;
  const date =
    raw.startDate ?? raw.expenseDate ?? raw.date ?? raw.createdAt ?? new Date().toISOString();
  return {
    id: raw.id,
    expenseNumber: raw.expenseNumber ? String(raw.expenseNumber) : undefined,
    name: String(raw.name || raw.description || 'Expense'),
    description: raw.description ? String(raw.description) : undefined,
    category: mapFinanceExpenseCategory(raw),
    type: raw.type === 'recurring' ? 'recurring' : 'one-time',
    recurrenceInterval: raw.recurrenceInterval as Expense['recurrenceInterval'],
    amount,
    startDate: String(date),
    endDate: raw.endDate ? String(raw.endDate) : undefined,
    paymentMethod: (raw.paymentMethod as Expense['paymentMethod']) || 'cash',
    status,
    paidAmount,
    notes: raw.notes ? String(raw.notes) : undefined,
    supplierId: raw.supplierId ? String(raw.supplierId) : undefined,
    vendorName: raw.vendorName ? String(raw.vendorName) : undefined,
    createdAt: String(raw.createdAt ?? date),
    updatedAt: String(raw.updatedAt ?? date),
  };
}

function mapTopLevelSalaryToStaffPayment(id: string, data: Record<string, unknown>): StaffPayment {
  const { periodStart, periodEnd } = parsePaymentPeriod(data.paymentPeriod);
  const statusRaw = String(data.status || 'paid').toLowerCase();
  return {
    id,
    staffId: String(data.staffId || ''),
    staffName: String(data.staffName || 'Staff'),
    amount: Number(data.amount ?? data.netAmount ?? 0),
    periodStart,
    periodEnd,
    status: statusRaw === 'paid' ? 'paid' : 'unpaid',
    paidDate: data.paymentDate ? String(data.paymentDate) : undefined,
    paymentMethod: String(data.paymentMethod || 'cash') as StaffPayment['paymentMethod'],
    notes: data.paymentPeriod ? `Period: ${String(data.paymentPeriod)}` : undefined,
    createdAt: String(data.createdAt ?? data.paymentDate ?? new Date().toISOString()),
  };
}

export async function loadAccountingFromFirestore(storeId: string): Promise<AccountingFirestoreData> {
  const [
    expensesRaw,
    operationalLegacy,
    expenseEntries,
    staff,
    staffPayments,
    deliveryPersons,
    deliveryOrders,
    cashCollections,
    cashBalanceRaw,
    cashTransactions,
  ] = await Promise.all([
    listStoreCollection<Expense>(storeId, 'expenses'),
    listStoreCollection<Expense>(storeId, 'operationalExpenses'),
    listStoreCollection<ExpenseEntry>(storeId, 'expenseEntries'),
    listStoreCollection<Staff>(storeId, 'staff'),
    listStoreCollection<StaffPayment>(storeId, 'staffPayments'),
    listStoreCollection<DeliveryPerson>(storeId, 'deliveryPersons'),
    listStoreCollection<DeliveryOrder>(storeId, 'deliveryOrders'),
    listStoreCollection<CashCollection>(storeId, 'cashCollections'),
    loadCashBalance(storeId),
    listStoreCollection<CashTransaction>(storeId, 'cashTransactions'),
  ]);

  const byId = new Map<string, Expense>();
  for (const exp of operationalLegacy) {
    byId.set(exp.id, normalizeFinanceExpense(exp as Record<string, unknown> & { id: string }));
  }
  for (const exp of expensesRaw) {
    byId.set(exp.id, normalizeFinanceExpense(exp as Record<string, unknown> & { id: string }));
  }
  const expenses = [...byId.values()];
  let normalizedStaffPayments = staffPayments;
  if (normalizedStaffPayments.length === 0) {
    try {
      const topLevelSalaryPayments = await getDocs(
        query(collection(getFinanceDb(), 'salaryPayments'), where('storeId', '==', storeId)),
      );
      normalizedStaffPayments = topLevelSalaryPayments.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
        .filter((row) => !row.duplicateCleanupReason)
        .map((row) => mapTopLevelSalaryToStaffPayment(row.id, row));
    } catch {
      // Legacy top-level collection may be blocked by rules; GL subledger still loads.
      normalizedStaffPayments = [];
    }
  }

  return {
    expenses,
    expenseEntries,
    staff,
    staffPayments: normalizedStaffPayments,
    deliveryPersons,
    deliveryOrders,
    cashCollections,
    cashBalance: cashBalanceRaw ? (cashBalanceRaw as unknown as CashBalance) : DEFAULT_CASH_BALANCE,
    cashTransactions,
  };
}

export async function saveAccountingSlice<K extends keyof AccountingFirestoreData>(
  storeId: string,
  key: K,
  value: AccountingFirestoreData[K],
): Promise<void> {
  if (key === 'cashBalance') {
    await saveCashBalance(storeId, (value as CashBalance) as unknown as Record<string, unknown>);
    return;
  }

  const collectionMap: Record<
    Exclude<keyof AccountingFirestoreData, 'cashBalance'>,
    Parameters<typeof replaceStoreCollection>[1]
  > = {
    expenses: 'expenses',
    expenseEntries: 'expenseEntries',
    staff: 'staff',
    staffPayments: 'staffPayments',
    deliveryPersons: 'deliveryPersons',
    deliveryOrders: 'deliveryOrders',
    cashCollections: 'cashCollections',
    cashTransactions: 'cashTransactions',
  };

  const colKey = collectionMap[key as Exclude<keyof AccountingFirestoreData, 'cashBalance'>];
  await replaceStoreCollection(
    storeId,
    colKey,
    (value as Array<{ id: string } & Record<string, unknown>>).map((item) => {
      const { id, ...rest } = item;
      return { id, ...rest };
    }),
  );
}

export { DEFAULT_CASH_BALANCE };
