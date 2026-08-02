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

export type AccountingPrimaryTab = (typeof ACCOUNTING_PRIMARY_TABS)[number];
export type AccountingReportTab = (typeof ACCOUNTING_REPORT_TABS)[number];
export type AccountingSettingsTab = (typeof ACCOUNTING_SETTINGS_TABS)[number];

export function isAccountingReportTab(tab: string): tab is AccountingReportTab {
  return (ACCOUNTING_REPORT_TABS as readonly string[]).includes(tab);
}

export function isAccountingSettingsTab(tab: string): tab is AccountingSettingsTab {
  return (ACCOUNTING_SETTINGS_TABS as readonly string[]).includes(tab);
}

export function isAccountingPrimaryTab(tab: string): tab is AccountingPrimaryTab {
  return (ACCOUNTING_PRIMARY_TABS as readonly string[]).includes(tab);
}

export function accountingTabBackLink(tab: string): { to: string; label: string } {
  if (isAccountingReportTab(tab)) {
    return { to: '/admin/finance/reports', label: 'Back to Reports' };
  }
  if (isAccountingSettingsTab(tab)) {
    return { to: '/admin/finance/settings', label: 'Back to Settings' };
  }
  return { to: '/admin/finance/accounting', label: 'Back to Accounting' };
}

export const ALL_ACCOUNTING_TABS = [
  'hub',
  ...ACCOUNTING_PRIMARY_TABS,
  ...ACCOUNTING_REPORT_TABS,
  ...ACCOUNTING_SETTINGS_TABS,
] as const;
