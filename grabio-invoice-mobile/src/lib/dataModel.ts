/** Grabio Invoice Manager + CRM — shared Firestore paths (same as web finance app). */

export const FINANCE_COLLECTIONS = {
  invoices: 'financeInvoices',
  estimates: 'financeEstimates',
  receipts: 'financeReceipts',
  purchaseOrders: 'financePurchaseOrders',
  expenses: 'financeExpenses',
  clientPlans: 'financeClientPlans',
  serviceTasks: 'financeServiceTasks',
} as const;

export function storeFinancePath(storeId: string, key: keyof typeof FINANCE_COLLECTIONS): string {
  return `stores/${storeId}/${FINANCE_COLLECTIONS[key]}`;
}

export const SHARED_COLLECTIONS = {
  customers: 'customers',
  products: 'products',
  suppliers: 'suppliers',
  crmActivities: 'crmActivities',
  storeProfiles: 'storeProfiles',
} as const;
