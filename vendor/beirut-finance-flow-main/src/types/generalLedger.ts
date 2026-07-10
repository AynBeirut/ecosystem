export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type NormalBalance = 'debit' | 'credit';

export type JournalEntryStatus = 'posted' | 'void';

export type JournalSourceType =
  | 'manual'
  | 'opening'
  | 'invoice'
  | 'expense'
  | 'purchase'
  | 'purchase_payment'
  | 'reversal'
  | 'delivery_wallet'
  | 'cash_collection'
  | 'order'
  | 'production'
  | 'payroll';

export interface LedgerAccount {
  id: string;
  storeId: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  isSystem: boolean;
  isActive: boolean;
  /** Net opening balance in account's normal-balance direction (Phase 3). */
  openingBalance?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  storeId: string;
  date: string;
  memo: string;
  status: JournalEntryStatus;
  sourceType: JournalSourceType;
  sourceId?: string;
  sourceKey: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface JournalLine {
  id: string;
  storeId: string;
  entryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  lineOrder: number;
}

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface PostJournalInput {
  storeId: string;
  date: string;
  memo: string;
  sourceType: JournalSourceType;
  sourceId?: string;
  event: string;
  currency?: string;
  createdBy?: string;
  lines: JournalLineInput[];
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
  asOfDate?: string;
}

export interface BalanceSheetSection {
  title: string;
  rows: Array<{ code: string; name: string; amount: number }>;
  subtotal: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

export type PeriodLockType = 'month' | 'quarter';

export type PeriodLockAuditEvent = {
  action: 'close' | 'reopen';
  at: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  reason?: string;
};

export interface LedgerPeriodClosure {
  id: string;
  storeId: string;
  periodType: PeriodLockType;
  startDate: string;
  endDate: string;
  label: string;
  isClosed: boolean;
  history: PeriodLockAuditEvent[];
  createdAt: string;
  updatedAt: string;
}
