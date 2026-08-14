import type { LucideIcon } from 'lucide-react';
import type { FinancePageLoader } from '@/pages/admin/finance/financeEmbeddedLoaders';
import { loadAccounting, loadAccountStatement, loadFinanceReports, loadFinanceTools } from '@/pages/admin/finance/financeEmbeddedLoaders';

/** Business Finance — full accounting suite (legacy ERP Module menu). */
export const BUSINESS_FINANCE_MODULES = [
  'accounting',
  'coa',
  'stock',
  'payables',
  'receivables',
  'bank',
  'assets',
  'reports',
  'tools',
  'account-statement',
] as const;

export type BusinessFinanceModule = (typeof BUSINESS_FINANCE_MODULES)[number];

export type BusinessFinanceModuleDef = {
  key: BusinessFinanceModule;
  path: string;
  label: string;
  loader: FinancePageLoader;
  icon?: LucideIcon;
};

export function isBusinessFinanceModule(value: string): value is BusinessFinanceModule {
  return (BUSINESS_FINANCE_MODULES as readonly string[]).includes(value);
}

const REPORT_MODULE_PATHS: Partial<Record<BusinessFinanceModule, string>> = {
  payables: '/admin/finance/payables',
  receivables: '/admin/finance/receivables',
  bank: '/admin/finance/bank',
  assets: '/admin/finance/assets',
  reports: '/admin/finance/reports',
  stock: '/admin/finance/stock',
};

/** Map URL path → module key. */
export function businessFinanceModuleFromPath(pathname: string): BusinessFinanceModule {
  if (pathname.startsWith('/admin/finance/account-statement')) return 'account-statement';
  if (pathname.startsWith('/admin/finance/coa')) return 'coa';
  if (pathname.startsWith('/admin/finance/stock')) return 'stock';
  if (pathname.startsWith('/admin/finance/payables')) return 'payables';
  if (pathname.startsWith('/admin/finance/receivables')) return 'receivables';
  if (pathname.startsWith('/admin/finance/bank')) return 'bank';
  if (pathname.startsWith('/admin/finance/assets')) return 'assets';
  if (pathname.startsWith('/admin/finance/reports')) return 'reports';
  if (pathname.startsWith('/admin/finance/tools') || pathname.startsWith('/admin/finance/settings')) {
    return 'tools';
  }
  if (pathname.startsWith('/admin/finance/accounting')) return 'accounting';
  return 'accounting';
}

export function businessFinanceModulePath(module: BusinessFinanceModule): string {
  switch (module) {
    case 'accounting':
      return '/admin/finance/accounting';
    case 'coa':
      return '/admin/finance/coa';
    case 'stock':
      return '/admin/finance/stock';
    case 'payables':
      return '/admin/finance/payables';
    case 'receivables':
      return '/admin/finance/receivables';
    case 'bank':
      return '/admin/finance/bank';
    case 'assets':
      return '/admin/finance/assets';
    case 'reports':
      return '/admin/finance/reports';
    case 'tools':
      return '/admin/finance/tools';
    case 'account-statement':
      return '/admin/finance/account-statement';
  }
}

/** Route payables / receivables / bank / assets reports to the right module bucket. */
export function businessFinanceModuleForReport(reportTab: string): BusinessFinanceModule {
  if (reportTab === 'sales' || reportTab === 'purchases' || reportTab === 'inventory' || reportTab === 'products') {
    return 'stock';
  }
  if (reportTab === 'ap-aging') return 'payables';
  if (reportTab === 'ar-aging') return 'receivables';
  if (reportTab === 'bank-rec' || reportTab === 'cash-flow') return 'bank';
  if (reportTab === 'depreciation') return 'assets';
  return 'reports';
}

export const BUSINESS_FINANCE_MODULE_DEFS: BusinessFinanceModuleDef[] = [
  { key: 'accounting', path: '/admin/finance/accounting', label: 'Accounting', loader: loadAccounting },
  { key: 'coa', path: '/admin/finance/coa', label: 'Chart of accounts', loader: loadFinanceTools },
  { key: 'stock', path: '/admin/finance/stock', label: 'Stock', loader: loadFinanceReports },
  { key: 'payables', path: '/admin/finance/payables', label: 'Payables', loader: loadFinanceReports },
  { key: 'receivables', path: '/admin/finance/receivables', label: 'Receivables', loader: loadFinanceReports },
  { key: 'bank', path: '/admin/finance/bank', label: 'Bank', loader: loadFinanceReports },
  { key: 'assets', path: '/admin/finance/assets', label: 'Assets', loader: loadFinanceReports },
  { key: 'reports', path: '/admin/finance/reports', label: 'Reports', loader: loadFinanceReports },
  { key: 'tools', path: '/admin/finance/tools', label: 'Tools', loader: loadFinanceTools },
  { key: 'account-statement', path: '/admin/finance/account-statement', label: 'Account statement', loader: loadAccountStatement },
];

export function isReportFinanceModule(module: string): module is keyof typeof REPORT_MODULE_PATHS {
  return module in REPORT_MODULE_PATHS;
}
