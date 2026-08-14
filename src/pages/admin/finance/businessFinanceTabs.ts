/** Primary accounting work — shown on Accounting hub (not Reports/Settings). */
export const ACCOUNTING_PRIMARY_TABS = ['vouchers', 'workspace', 'party-soa'] as const;

/** Opened from Reports hub — hidden from Accounting tab bar. */
export const ACCOUNTING_REPORT_TABS = [
  'trial-balance',
  'balance-sheet',
  'profit-loss',
  'depreciation',
  'reconciliation',
  'general-ledger',
  'party-soa',
  'vat-filing',
  'ar-aging',
  'ap-aging',
  'cash-flow',
  'bank-rec',
  'tax-reports',
] as const;

/** Opened from Settings hub — hidden from Accounting tab bar. */
export const ACCOUNTING_SETTINGS_TABS = [
  'coa',
  'opening',
  'fx-revaluation',
  'cost-centers',
  'bulk-import',
  'recurring',
  'checks',
] as const;

/** Opened from Settings → Documents (A4 print branding, not POS receipts). */
export const FINANCE_DOCUMENT_TABS = ['invoice-template'] as const;

export type FinanceDocumentTab = (typeof FINANCE_DOCUMENT_TABS)[number];
export type AccountingPrimaryTab = (typeof ACCOUNTING_PRIMARY_TABS)[number];
export type AccountingReportTab = (typeof ACCOUNTING_REPORT_TABS)[number];
export type AccountingSettingsTab = (typeof ACCOUNTING_SETTINGS_TABS)[number];

export function isAccountingReportTab(tab: string): tab is AccountingReportTab {
  return (ACCOUNTING_REPORT_TABS as readonly string[]).includes(tab);
}

export function isAccountingSettingsTab(tab: string): tab is AccountingSettingsTab {
  return (ACCOUNTING_SETTINGS_TABS as readonly string[]).includes(tab);
}

export function isFinanceDocumentTab(tab: string): tab is FinanceDocumentTab {
  return (FINANCE_DOCUMENT_TABS as readonly string[]).includes(tab);
}

export function isAccountingPrimaryTab(tab: string): tab is AccountingPrimaryTab {
  return (ACCOUNTING_PRIMARY_TABS as readonly string[]).includes(tab);
}

/** Opened from Reports hub — stock & operations lists. */
export const STOCK_REPORT_TABS = ['sales', 'purchases', 'inventory', 'products'] as const;

export type StockReportTab = (typeof STOCK_REPORT_TABS)[number];

export function isStockReportTab(tab: string): tab is StockReportTab {
  return (STOCK_REPORT_TABS as readonly string[]).includes(tab);
}

export function isReportsHubTab(tab: string): boolean {
  return isAccountingReportTab(tab) || isStockReportTab(tab);
}

export function accountingTabBackLink(tab: string): { to: string; label: string } {
  if (isStockReportTab(tab)) {
    return { to: `/admin/finance/stock?report=${encodeURIComponent(tab)}`, label: 'Back' };
  }
  if (isAccountingReportTab(tab)) {
    const module =
      tab === 'ap-aging'
        ? 'payables'
        : tab === 'ar-aging'
          ? 'receivables'
          : tab === 'bank-rec' || tab === 'cash-flow'
            ? 'bank'
            : tab === 'depreciation'
              ? 'assets'
              : 'reports';
    return { to: `/admin/finance/${module}?report=${encodeURIComponent(tab)}`, label: 'Back' };
  }
  if (isAccountingSettingsTab(tab)) {
    if (tab === 'coa') {
      return { to: '/admin/finance/coa?setting=coa', label: 'Back' };
    }
    return { to: `/admin/finance/tools?setting=${encodeURIComponent(tab)}`, label: 'Back' };
  }
  return { to: '/admin/finance/accounting', label: 'Back to Accounting' };
}

export const ALL_ACCOUNTING_TABS = [
  'hub',
  ...ACCOUNTING_PRIMARY_TABS,
  ...ACCOUNTING_REPORT_TABS,
  ...ACCOUNTING_SETTINGS_TABS,
] as const;
