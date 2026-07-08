/** Firestore collection paths for Grabio Invoice Manager (store-scoped). */

export const FINANCE_COLLECTIONS = {
  invoices: 'financeInvoices',
  estimates: 'financeEstimates',
  receipts: 'financeReceipts',
  payments: 'financePayments',
  expenses: 'financeExpenses',
  suppliers: 'financeSuppliers',
  purchaseOrders: 'financePurchaseOrders',
  inventoryMovements: 'financeInventoryMovements',
  projects: 'financeProjects',
  proposals: 'financeProposals',
  tasks: 'financeTasks',
  timesheets: 'financeTimesheets',
  currencySettings: 'financeCurrencySettings',
  paymentMethods: 'financePaymentMethods',
  activityLogs: 'financeActivityLogs',
  members: 'financeMembers',
  staff: 'financeStaff',
  staffPayments: 'financeStaffPayments',
  deliveryPersons: 'financeDeliveryPersons',
  deliveryOrders: 'financeDeliveryOrders',
  cashCollections: 'financeCashCollections',
  cashTransactions: 'financeCashTransactions',
  operationalExpenses: 'financeOperationalExpenses',
  expenseEntries: 'financeExpenseEntries',
} as const;

export type FinanceCollectionKey = keyof typeof FINANCE_COLLECTIONS;

export function storeCollectionPath(storeId: string, key: FinanceCollectionKey): string {
  return `stores/${storeId}/${FINANCE_COLLECTIONS[key]}`;
}

export function customersPath(): string {
  return 'customers';
}

export function productsPath(): string {
  return 'products';
}

export function storeProfilePath(storeId: string): string {
  return `storeProfiles/${storeId}`;
}
