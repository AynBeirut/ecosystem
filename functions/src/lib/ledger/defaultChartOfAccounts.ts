export const GL_ACCOUNT_CODES = {
  CASH: '1000',
  BANK: '1010',
  DELIVERY_WALLET: '1050',
  AR: '1100',
  INVENTORY: '1200',
  FG_INVENTORY: '1201',
  AP: '2000',
  REVENUE: '4000',
  COGS: '5000',
  PAYROLL: '6020',
  GENERAL_EXPENSE: '6099',
} as const;

export const DEFAULT_SMB_COA = [
  { code: '1000', name: 'Cash on Hand', type: 'asset', normalBalance: 'debit' },
  { code: '1010', name: 'Bank', type: 'asset', normalBalance: 'debit' },
  { code: '1050', name: 'Delivery Wallet', type: 'asset', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '1201', name: 'Finished Goods Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: '3000', name: "Owner's Equity", type: 'equity', normalBalance: 'credit' },
  { code: '3100', name: 'Opening Balance Equity', type: 'equity', normalBalance: 'credit' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit' },
  { code: '6000', name: 'Rent Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6010', name: 'Utilities Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6020', name: 'Payroll Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6099', name: 'General Expense', type: 'expense', normalBalance: 'debit' },
] as const;

export type LedgerAccountRow = {
  id: string;
  storeId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  isSystem: boolean;
  isActive: boolean;
  openingBalance: number;
  createdAt: string;
  updatedAt: string;
};

export function ledgerAccountDocId(code: string): string {
  return `acct-${code}`;
}

export function buildDefaultLedgerAccounts(storeId: string): LedgerAccountRow[] {
  const ts = new Date().toISOString();
  return DEFAULT_SMB_COA.map((row) => ({
    id: ledgerAccountDocId(row.code),
    storeId,
    code: row.code,
    name: row.name,
    type: row.type,
    normalBalance: row.normalBalance,
    isSystem: true,
    isActive: true,
    openingBalance: 0,
    createdAt: ts,
    updatedAt: ts,
  }));
}
