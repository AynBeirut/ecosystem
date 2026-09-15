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
  'year-end-close',
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

/** Owner personal wallet — Bank hub (Grabio-native). */
export const PERSONAL_WALLET_TABS = ['personal-wallet'] as const;

/** Owner client portfolio — Receivables hub. */
export const CLIENT_PORTFOLIO_TABS = ['client-portfolio'] as const;

/** Owner Whish income — Receivables hub (Grabio-native, not ERP embed). */
export const SERVICE_INCOME_TABS = ['service-income'] as const;

/** Owner project receivables — Receivables hub. */
export const OWNER_RECEIVABLES_TABS = ['owner-receivables'] as const;

/** Owner Stayha loan payables — Payables hub. */
export const STAYHA_LOANS_TABS = ['stayha-loans'] as const;

/** Opened from Reports hub — stock & operations lists. */
export const STOCK_REPORT_TABS = ['sales', 'purchases', 'inventory', 'products'] as const;

export type StockReportTab = (typeof STOCK_REPORT_TABS)[number];
export type ClientPortfolioTab = (typeof CLIENT_PORTFOLIO_TABS)[number];
export type ServiceIncomeTab = (typeof SERVICE_INCOME_TABS)[number];
export type OwnerReceivablesTab = (typeof OWNER_RECEIVABLES_TABS)[number];
export type StayhaLoansTab = (typeof STAYHA_LOANS_TABS)[number];
export type PersonalWalletTab = (typeof PERSONAL_WALLET_TABS)[number];

export function isStockReportTab(tab: string): tab is StockReportTab {
  return (STOCK_REPORT_TABS as readonly string[]).includes(tab);
}

export function isClientPortfolioTab(tab: string): tab is ClientPortfolioTab {
  return (CLIENT_PORTFOLIO_TABS as readonly string[]).includes(tab);
}

export function isServiceIncomeTab(tab: string): tab is ServiceIncomeTab {
  return (SERVICE_INCOME_TABS as readonly string[]).includes(tab);
}

export function isOwnerReceivablesTab(tab: string): tab is OwnerReceivablesTab {
  return (OWNER_RECEIVABLES_TABS as readonly string[]).includes(tab);
}

export function isPersonalWalletTab(tab: string): tab is PersonalWalletTab {
  return (PERSONAL_WALLET_TABS as readonly string[]).includes(tab);
}

export function isStayhaLoansTab(tab: string): tab is StayhaLoansTab {
  return (STAYHA_LOANS_TABS as readonly string[]).includes(tab);
}

/** Grabio-native owner pages embedded in finance hubs (not ERP Accounting iframe). */
export function isOwnerNativeFinanceTab(tab: string): boolean {
  return (
    isClientPortfolioTab(tab) ||
    isServiceIncomeTab(tab) ||
    isOwnerReceivablesTab(tab) ||
    isPersonalWalletTab(tab) ||
    isStayhaLoansTab(tab)
  );
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
