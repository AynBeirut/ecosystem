import type { ComponentType } from 'react';

export const loadInvoiceManager = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/InvoiceManager.tsx');
export const loadEstimateManager = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/EstimateManager.tsx');
export const loadReceiptManager = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/ReceiptManager.tsx');
export const loadClientsManager = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/ClientsManager.tsx');
export const loadProductsManager = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/ProductsManager.tsx');
export const loadFinanceReports = () => import('@/pages/admin/finance/BusinessFinanceReports');
export const loadFinanceSettings = () => import('@/pages/admin/finance/BusinessFinanceSettings');
export const loadExpenseManager = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/ExpenseManager.tsx');
export const loadAccounting = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/Accounting.tsx');

export type FinancePageLoader = () => Promise<{ default: ComponentType }>;

export const FINANCE_PAGE_LOADERS: FinancePageLoader[] = [
  loadEstimateManager,
  loadReceiptManager,
  loadFinanceReports,
  loadFinanceSettings,
  loadAccounting,
  loadInvoiceManager,
  loadExpenseManager,
];

const pageCache = new Map<FinancePageLoader, ComponentType>();

export function getCachedFinancePage(loader: FinancePageLoader): ComponentType | undefined {
  return pageCache.get(loader);
}

export async function loadFinancePage(loader: FinancePageLoader): Promise<ComponentType> {
  const cached = pageCache.get(loader);
  if (cached) return cached;
  const mod = await loader();
  pageCache.set(loader, mod.default);
  return mod.default;
}

export function preloadFinancePages(loaders: FinancePageLoader[] = FINANCE_PAGE_LOADERS) {
  void Promise.all(loaders.map((loader) => loadFinancePage(loader).catch(() => undefined)));
}
