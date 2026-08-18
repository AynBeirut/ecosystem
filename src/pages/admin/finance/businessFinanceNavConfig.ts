import {
  ACCOUNTING_PRIMARY_TABS,
  ACCOUNTING_REPORT_TABS,
  ACCOUNTING_SETTINGS_TABS,
  STOCK_REPORT_TABS,
} from '@/pages/admin/finance/businessFinanceTabs';

export type FinanceNavOption = { value: string; label: string; group?: string };

/** Legacy ERP Module menu — accounting management only. */
export const FINANCE_MODULE_OPTIONS = [
  { value: 'accounting', label: 'Accounting' },
  { value: 'coa', label: 'Chart of accounts' },
  { value: 'stock', label: 'Stock' },
  { value: 'payables', label: 'Payables' },
  { value: 'receivables', label: 'Receivables' },
  { value: 'bank', label: 'Bank' },
  { value: 'assets', label: 'Assets' },
  { value: 'reports', label: 'Reports' },
  { value: 'tools', label: 'Tools' },
  { value: 'account-statement', label: 'Account statement' },
] as const;

const ACCOUNTING_PRIMARY_LABELS: Record<(typeof ACCOUNTING_PRIMARY_TABS)[number], string> = {
  vouchers: 'Vouchers (JV / PV / RV / CV)',
  workspace: 'Workspace',
  'party-soa': 'Party statement',
};

const TOOLS_LABELS: Record<string, string> = {
  coa: 'Chart of accounts',
  opening: 'Opening balances',
  'fx-revaluation': 'Foreign exchange (FX)',
  'cost-centers': 'Cost centers',
  'bulk-import': 'Bulk import',
  recurring: 'Recurring vouchers',
  checks: 'Check register',
  'year-end-close': 'Year-end close',
};

const REPORT_LABELS: Record<string, string> = {
  'trial-balance': 'Trial balance',
  'balance-sheet': 'Balance sheet',
  'profit-loss': 'Profit & loss',
  'cash-flow': 'Cash flow',
  depreciation: 'Depreciation',
  reconciliation: 'Reconciliation',
  'general-ledger': 'General ledger',
  'party-soa': 'Party statement',
  'vat-filing': 'VAT filing',
  'ar-aging': 'AR aging',
  'ap-aging': 'AP aging',
  'bank-rec': 'Bank reconciliation',
  'tax-reports': 'Tax (R10 / CNSS)',
  sales: 'List of sales',
  purchases: 'List of purchases',
  inventory: 'Inventory & stock',
  products: 'Items & price list',
};

export function accountingSubNavOptions(): FinanceNavOption[] {
  return ACCOUNTING_PRIMARY_TABS.map((value) => ({
    value,
    label: ACCOUNTING_PRIMARY_LABELS[value],
  }));
}

export function payablesSubNavOptions(): FinanceNavOption[] {
  return [
    { value: 'ap-aging', label: REPORT_LABELS['ap-aging'] },
    { value: 'party-soa', label: 'Supplier statement' },
    { value: 'reconciliation', label: 'AP reconciliation' },
  ];
}

export function receivablesSubNavOptions(): FinanceNavOption[] {
  return [
    { value: 'ar-aging', label: REPORT_LABELS['ar-aging'] },
    { value: 'party-soa', label: 'Customer statement' },
  ];
}

export function bankSubNavOptions(): FinanceNavOption[] {
  return [
    { value: 'bank-rec', label: REPORT_LABELS['bank-rec'] },
    { value: 'cash-flow', label: REPORT_LABELS['cash-flow'] },
    { value: 'reconciliation', label: REPORT_LABELS.reconciliation },
  ];
}

export function assetsSubNavOptions(): FinanceNavOption[] {
  return [{ value: 'depreciation', label: REPORT_LABELS.depreciation }];
}

export function toolsSubNavOptions(): FinanceNavOption[] {
  return ACCOUNTING_SETTINGS_TABS.filter((value) => value !== 'coa').map((value) => ({
    value,
    label: TOOLS_LABELS[value] ?? value,
  }));
}

export function stockSubNavOptions(): FinanceNavOption[] {
  return STOCK_REPORT_TABS.map((value) => ({
    value,
    label: REPORT_LABELS[value] ?? value,
  }));
}

export function reportsSubNavOptions(): FinanceNavOption[] {
  return ACCOUNTING_REPORT_TABS.filter(
    (value) =>
      !['ap-aging', 'ar-aging', 'bank-rec', 'cash-flow', 'depreciation', 'party-soa'].includes(value),
  ).map((value) => ({
    value,
    label: REPORT_LABELS[value] ?? value,
  }));
}

export function financeSubNavOptions(module: string): FinanceNavOption[] {
  if (module === 'accounting') return accountingSubNavOptions();
  if (module === 'stock') return stockSubNavOptions();
  if (module === 'payables') return payablesSubNavOptions();
  if (module === 'receivables') return receivablesSubNavOptions();
  if (module === 'bank') return bankSubNavOptions();
  if (module === 'assets') return assetsSubNavOptions();
  if (module === 'tools') return toolsSubNavOptions();
  if (module === 'reports') return reportsSubNavOptions();
  return [];
}

export function financeSubNavLabel(module: string, value: string | null): string {
  if (!value) return 'Choose…';
  const match = financeSubNavOptions(module).find((item) => item.value === value);
  return match?.label ?? value;
}

/** First sensible page when switching module — stock defaults to inventory, not list order. */
export function defaultFinanceSubNavValue(module: string): string | null {
  if (module === 'coa') return 'coa';
  if (module === 'stock') return 'inventory';
  const options = financeSubNavOptions(module);
  return options[0]?.value ?? null;
}

export function isFinanceReportSubNavValue(value: string): boolean {
  return (
    (ACCOUNTING_REPORT_TABS as readonly string[]).includes(value) ||
    (STOCK_REPORT_TABS as readonly string[]).includes(value)
  );
}

export function isFinanceSettingSubNavValue(value: string): boolean {
  return (ACCOUNTING_SETTINGS_TABS as readonly string[]).includes(value);
}
