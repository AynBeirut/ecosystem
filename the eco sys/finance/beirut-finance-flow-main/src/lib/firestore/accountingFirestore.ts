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

export async function loadAccountingFromFirestore(storeId: string): Promise<AccountingFirestoreData> {
  const [
    expenses,
    expenseEntries,
    staff,
    staffPayments,
    deliveryPersons,
    deliveryOrders,
    cashCollections,
    cashBalanceRaw,
    cashTransactions,
  ] = await Promise.all([
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

  return {
    expenses,
    expenseEntries,
    staff,
    staffPayments,
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
    expenses: 'operationalExpenses',
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
    (value as Array<{ id: string }>).map((item) => ({ ...item })),
  );
}

export { DEFAULT_CASH_BALANCE };
