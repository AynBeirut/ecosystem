export type LedgerAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type NormalBalance = 'debit' | 'credit';

export type JournalEntryStatus = 'draft' | 'pending_approval' | 'posted' | 'reversed' | 'void';

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
  | 'payroll'
  | 'adjustment'
  | 'depreciation';

export type VoucherType = 'JV' | 'PV' | 'RV' | 'CV';

export type CheckStatus = 'issued' | 'cleared' | 'void';

export type SettlementAllocationInput = {
  documentId: string;
  documentType: 'invoice' | 'purchase_order';
  allocatedAmountBase: number;
  allocatedAmountFx?: number;
};

export type PaymentVoucherMeta = {
  payee?: string;
  paymentRef?: string;
  paidFromAccountId: string;
  paidToAccountId: string;
  supplierId?: string;
  checkNumber?: string;
  checkStatus?: CheckStatus;
  checkAmount?: number;
  amount?: number;
  allocations?: SettlementAllocationInput[];
};

export type ReceiptVoucherMeta = {
  payer?: string;
  receiptRef?: string;
  receivedIntoAccountId: string;
  receivedFromAccountId: string;
  clientId?: string;
  allocations?: SettlementAllocationInput[];
};

export interface VoucherLineSettlement {
  id: string;
  storeId: string;
  paymentEntryId: string;
  paymentLineId?: string;
  documentId: string;
  documentType: 'invoice' | 'purchase_order';
  allocatedAmountBase: number;
  allocatedAmountFx: number;
  createdAt: string;
  createdBy?: string;
}

export interface PartyStatementRow {
  date: string;
  voucherType?: string;
  refNumber?: string;
  entryId: string;
  debit: number;
  credit: number;
  runningBalance: number;
  matchedDocumentId?: string;
  memo?: string;
}

export interface PartyStatementReport {
  partyId?: string;
  partyName: string;
  partyType: 'client' | 'supplier';
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  rows: PartyStatementRow[];
}

export type LedgerAuditAction =
  | 'draft_saved'
  | 'pending_approval_saved'
  | 'submitted'
  | 'approved'
  | 'posted'
  | 'reversed'
  | 'period_reopened';

export interface LedgerAuditLogEntry {
  id: string;
  storeId: string;
  action: LedgerAuditAction;
  entryId?: string;
  actorUid: string;
  timestamp: string;
  memo?: string;
}

export type TrialBalanceViewMode = '2col' | '4col' | '6col';

export interface TrialBalanceExtendedRow extends TrialBalanceRow {
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalanceExtendedReport {
  viewMode: TrialBalanceViewMode;
  rows: TrialBalanceExtendedRow[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
  asOfDate?: string;
  startDate?: string;
  endDate?: string;
}

export interface GeneralLedgerReportRow {
  date: string;
  entryId: string;
  voucherNumber?: string;
  voucherType?: string;
  memo: string;
  debit: number;
  credit: number;
  runningBalance: number;
  costCenterId?: string;
}

export interface GeneralLedgerReport {
  accountId: string;
  accountCode: string;
  accountName: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  rows: GeneralLedgerReportRow[];
}

export type ContraVoucherMeta = {
  fromAccountId: string;
  toAccountId: string;
  transferRef?: string;
};

export type JournalVoucherMeta = Record<string, never>;

export type VoucherMeta =
  | PaymentVoucherMeta
  | ReceiptVoucherMeta
  | ContraVoucherMeta
  | JournalVoucherMeta;

export interface LedgerAccount {
  id: string;
  storeId: string;
  code: string;
  name: string;
  /** Arabic label (Lebanese COA template / manual entry). */
  nameAr?: string;
  type: LedgerAccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
  isSystem: boolean;
  isActive: boolean;
  /** Net opening balance in account's normal-balance direction (Phase 3). */
  openingBalance?: number;
  /** PCG row kind (G/D/C) when seeded from Excel chart. */
  pcgKind?: string;
  currency?: 'LL' | 'USD';
  /** Grabio 3-digit code that auto-posts into this PCG account. */
  grabioOperationalCode?: string;
  /** Full Lebanese PCG chart row (vs Grabio operational posting account). */
  isPcgChart?: boolean;
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
  /** Semantic posting event (also part of sourceKey). */
  event: string;
  currency: string;
  voucherType?: VoucherType;
  voucherNumber?: string;
  voucherMeta?: VoucherMeta;
  postedAt?: string;
  postedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  isSystemGenerated?: boolean;
  reversalOfEntryId?: string;
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
  currency: string;
  debit: number;
  credit: number;
  description?: string;
  lineOrder: number;
  transactionCurrency?: string;
  fxRate?: number;
  amountFx?: number;
  costCenterId?: string;
}

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  transactionCurrency?: string;
  fxRate?: number;
  amountFx?: number;
  costCenterId?: string;
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
  voucherType?: VoucherType;
  voucherNumber?: string;
  voucherMeta?: VoucherMeta;
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

export interface IncomeStatementRow {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatementSection {
  title: string;
  rows: IncomeStatementRow[];
  subtotal: number;
}

export interface IncomeStatementReport {
  startDate: string;
  endDate: string;
  revenue: IncomeStatementSection;
  otherIncome: IncomeStatementSection;
  cogs: IncomeStatementSection;
  operatingExpenses: IncomeStatementSection;
  financialExpenses: IncomeStatementSection;
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
}

export interface LedgerCostCenter {
  id: string;
  storeId: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RecurringVoucherFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringVoucherTemplate {
  id: string;
  storeId: string;
  name: string;
  voucherType: VoucherType;
  frequency: RecurringVoucherFrequency;
  dayOfMonth: number;
  nextRunDate: string;
  lastRunDate?: string;
  memo: string;
  lines: JournalLineInput[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckRegisterEntry {
  entryId: string;
  voucherNumber?: string;
  date: string;
  payee?: string;
  checkNumber?: string;
  amount: number;
  status: CheckStatus;
  bankAccountCode?: string;
}

export interface VatFilingSourceRow {
  sourceType: string;
  outputNet: number;
  inputNet: number;
  entryCount: number;
}

export interface VatFilingAccountSummary {
  accountCode: string;
  accountName: string;
  closingBalance: number;
  accountActive: boolean;
}

export interface VatFilingSummaryReport {
  startDate: string;
  endDate: string;
  currency: string;
  outputVat: VatFilingAccountSummary & {
    collected: number;
    reversed: number;
    net: number;
  };
  inputVat: VatFilingAccountSummary & {
    recoverable: number;
    reversed: number;
    net: number;
  };
  settlement?: VatFilingAccountSummary & {
    credits: number;
    debits: number;
    net: number;
  };
  netVatDue: number;
  netVatDueLabel: 'payable' | 'recoverable';
  entryCount: number;
  lineCount: number;
  bySource: VatFilingSourceRow[];
}

export type AgedReceivablesBucketKey = 'current' | 'days31_60' | 'days61_90' | 'days91_plus';

export interface AgedReceivablesRow {
  invoiceId: string;
  clientId?: string;
  clientName: string;
  invoiceDate: string;
  daysPast: number;
  bucket: AgedReceivablesBucketKey;
  outstanding: number;
  currency: string;
  status: string;
}

export interface AgedReceivablesReport {
  asOfDate: string;
  buckets: Record<AgedReceivablesBucketKey, number>;
  rows: AgedReceivablesRow[];
  subledgerTotal: number;
  glBalance: number;
  variance: number;
  matched: boolean;
  openInvoiceCount: number;
}

export type AgedPayablesBucketKey = 'current' | 'days31_60' | 'days61_90' | 'days91_plus';

export interface AgedPayablesRow {
  purchaseOrderId: string;
  supplierId?: string;
  supplierName: string;
  poDate: string;
  daysPast: number;
  bucket: AgedPayablesBucketKey;
  grossAmount: number;
  paidAmount: number;
  outstanding: number;
  currency: string;
  status: string;
}

export interface AgedPayablesReport {
  asOfDate: string;
  buckets: Record<AgedPayablesBucketKey, number>;
  rows: AgedPayablesRow[];
  subledgerTotal: number;
  glBalance: number;
  variance: number;
  matched: boolean;
  openPoCount: number;
}

export type CashFlowSection = 'operating' | 'investing' | 'financing' | 'reconciliation';

export interface CashFlowLineItem {
  label: string;
  amount: number;
  section: CashFlowSection;
  accountCode?: string;
}

export interface CashFlowStatementReport {
  startDate: string;
  endDate: string;
  currency: string;
  method: 'indirect';
  netIncome: number;
  workingCapitalAdjustments: number;
  netCashFromOperating: number;
  netCashFromInvesting: number;
  netCashFromFinancing: number;
  netChangeInCash: number;
  cashAtBeginning: number;
  cashAtEnd: number;
  cashDeltaFromAccounts: number;
  reconciliationVariance: number;
  reconciled: boolean;
  operatingLines: CashFlowLineItem[];
  investingLines: CashFlowLineItem[];
  financingLines: CashFlowLineItem[];
  cashBreakdown: CashFlowLineItem[];
}

export type FixedAssetStatus = 'active' | 'fully_depreciated' | 'retired';

export interface FixedAsset {
  id: string;
  storeId: string;
  name: string;
  inServiceDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  assetAccountCode: string;
  accumDeprAccountCode: string;
  expenseAccountCode: string;
  accumulatedDepreciation: number;
  status: FixedAssetStatus;
  currency: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationLinePreview {
  assetId: string;
  assetName: string;
  amount: number;
  skippedReason?: string;
}

export interface DepreciationRunPreview {
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  postDate: string;
  currency: string;
  lines: DepreciationLinePreview[];
  totalDepreciation: number;
  canPost: boolean;
  blockReason?: string;
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

/** GL bank rec — Phase 1 (statement capture + book side). */
export const BANK_REC_PHASE1_ACCOUNT_CODES = ['105', '106'] as const;

export type BankRecSessionStatus = 'draft' | 'locked';

export interface BankRecSession {
  id: string;
  storeId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  startDate: string;
  endDate: string;
  status: BankRecSessionStatus;
  phase: 1 | 2 | 3;
  /** Per bank statement — used for closing balance on report. */
  statementOpeningBalance?: number;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type BankStatementLineSource = 'manual' | 'csv';

export interface BankStatementLine {
  id: string;
  sessionId: string;
  storeId: string;
  lineDate: string;
  debit: number;
  credit: number;
  description: string;
  reference?: string;
  source: BankStatementLineSource;
  createdAt: string;
  updatedAt: string;
}

export type BankRecMatchType = 'manual' | 'auto';

export interface BankRecMatch {
  id: string;
  sessionId: string;
  storeId: string;
  statementLineId: string;
  bookLineId: string;
  matchType: BankRecMatchType;
  matchedAt: string;
  matchedBy?: string;
}

export interface AccountBookLine {
  lineId: string;
  entryId: string;
  entryDate: string;
  memo: string;
  voucherNumber?: string;
  sourceType?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface BankRecPhase1Summary {
  bookLineCount: number;
  statementLineCount: number;
  bookNetDebit: number;
  statementNetDebit: number;
  difference: number;
}

/** Store-specific PCG client extension (Phase 3 — display on reports; posting unchanged). */
export interface PcgClientAccount {
  id: string;
  storeId: string;
  /** Full client PCG code (typically 8–11 digits). */
  clientCode: string;
  /** Grabio 3-digit operational account this overrides in Lebanese reports. */
  grabioOperationalCode: string;
  /** Optional PCG parent for validation / hierarchy (e.g. 5300, 6018). */
  parentPcgCode?: string;
  name?: string;
  nameAr?: string;
  currency: 'LL' | 'USD';
  createdAt: string;
  updatedAt: string;
}
