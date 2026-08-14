import type { ComponentType } from 'react';

export const loadInvoiceManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/InvoiceManager.tsx');
export const loadEstimateManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/EstimateManager.tsx');
export const loadReceiptManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/ReceiptManager.tsx');
export const loadPurchaseOrders = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/PurchaseOrders.tsx');
export const loadExpenseManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/ExpenseManager.tsx');
export const loadClientsManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/ClientsManager.tsx');
export const loadSuppliersManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/SuppliersManager.tsx');
export const loadProductsManager = () =>
  import('../../../../vendor/beirut-finance-flow-main/src/pages/ProductsManager.tsx');

export type InvoicePageLoader = () => Promise<{ default: ComponentType }>;

export const INVOICE_PAGE_LOADERS: InvoicePageLoader[] = [
  loadInvoiceManager,
  loadEstimateManager,
  loadReceiptManager,
  loadPurchaseOrders,
  loadExpenseManager,
  loadClientsManager,
  loadSuppliersManager,
  loadProductsManager,
];

const pageCache = new Map<InvoicePageLoader, ComponentType>();

export function getCachedInvoicePage(loader: InvoicePageLoader): ComponentType | undefined {
  return pageCache.get(loader);
}

export async function loadInvoicePage(loader: InvoicePageLoader): Promise<ComponentType> {
  const cached = pageCache.get(loader);
  if (cached) return cached;
  const mod = await loader();
  pageCache.set(loader, mod.default);
  return mod.default;
}

export function preloadInvoicePages(loaders: InvoicePageLoader[] = INVOICE_PAGE_LOADERS) {
  void Promise.all(loaders.map((loader) => loadInvoicePage(loader).catch(() => undefined)));
}
