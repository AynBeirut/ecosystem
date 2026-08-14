import type { ComponentType } from 'react';

export const loadAccounting = () => import('../../../../vendor/beirut-finance-flow-main/src/pages/Accounting.tsx');
export const loadFinanceReports = () => import('@/pages/admin/finance/BusinessFinanceReports');
export const loadFinanceTools = () => import('@/pages/admin/finance/BusinessFinanceSettings');
export const loadAccountStatement = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/AccountStatement.tsx');

export type FinancePageLoader = () => Promise<{ default: ComponentType }>;

export const FINANCE_PAGE_LOADERS: FinancePageLoader[] = [
  loadAccounting,
  loadFinanceReports,
  loadFinanceTools,
  loadAccountStatement,
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
