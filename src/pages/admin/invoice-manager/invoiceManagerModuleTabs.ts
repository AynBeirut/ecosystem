import type { InvoicePageLoader } from '@/pages/admin/invoice-manager/invoiceEmbeddedLoaders';
import {
  loadClientsManager,
  loadEstimateManager,
  loadExpenseManager,
  loadInvoiceManager,
  loadProductsManager,
  loadPurchaseOrders,
  loadReceiptManager,
  loadSuppliersManager,
} from '@/pages/admin/invoice-manager/invoiceEmbeddedLoaders';

/** Invoice Manager — sales documents & purchasing (legacy Sales / Purchases). */
export const INVOICE_MANAGER_MODULES = [
  'invoices',
  'quotations',
  'receipts',
  'purchases',
  'expenses',
  'clients',
  'suppliers',
  'products',
] as const;

export type InvoiceManagerModule = (typeof INVOICE_MANAGER_MODULES)[number];

export type InvoiceManagerModuleDef = {
  key: InvoiceManagerModule;
  path: string;
  label: string;
  loader: InvoicePageLoader;
};

export function isInvoiceManagerModule(value: string): value is InvoiceManagerModule {
  return (INVOICE_MANAGER_MODULES as readonly string[]).includes(value);
}

export function invoiceManagerModuleFromPath(pathname: string): InvoiceManagerModule {
  if (pathname.startsWith('/admin/invoice-manager/quotations')) return 'quotations';
  if (pathname.startsWith('/admin/invoice-manager/receipts')) return 'receipts';
  if (pathname.startsWith('/admin/invoice-manager/purchases')) return 'purchases';
  if (pathname.startsWith('/admin/invoice-manager/expenses')) return 'expenses';
  if (pathname.startsWith('/admin/invoice-manager/clients')) return 'clients';
  if (pathname.startsWith('/admin/invoice-manager/suppliers')) return 'suppliers';
  if (pathname.startsWith('/admin/invoice-manager/products')) return 'products';
  return 'invoices';
}

export function invoiceManagerModulePath(module: InvoiceManagerModule): string {
  return `/admin/invoice-manager/${module}`;
}

export const INVOICE_MANAGER_MODULE_DEFS: InvoiceManagerModuleDef[] = [
  { key: 'invoices', path: '/admin/invoice-manager/invoices', label: 'Invoices', loader: loadInvoiceManager },
  { key: 'quotations', path: '/admin/invoice-manager/quotations', label: 'Quotations', loader: loadEstimateManager },
  { key: 'receipts', path: '/admin/invoice-manager/receipts', label: 'Receipts', loader: loadReceiptManager },
  { key: 'purchases', path: '/admin/invoice-manager/purchases', label: 'Purchases', loader: loadPurchaseOrders },
  { key: 'expenses', path: '/admin/invoice-manager/expenses', label: 'Expenses', loader: loadExpenseManager },
  { key: 'clients', path: '/admin/invoice-manager/clients', label: 'Clients', loader: loadClientsManager },
  { key: 'suppliers', path: '/admin/invoice-manager/suppliers', label: 'Suppliers', loader: loadSuppliersManager },
  { key: 'products', path: '/admin/invoice-manager/products', label: 'Products', loader: loadProductsManager },
];

export const INVOICE_MANAGER_MODULE_OPTIONS = INVOICE_MANAGER_MODULE_DEFS.map((item) => ({
  value: item.key,
  label: item.label,
}));
