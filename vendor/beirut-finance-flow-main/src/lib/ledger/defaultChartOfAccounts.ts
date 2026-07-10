import type { LedgerAccount, LedgerAccountType, NormalBalance } from '@/types/generalLedger';

type CoaSeed = {
  code: string;
  name: string;
  type: LedgerAccountType;
  normalBalance: NormalBalance;
};

/** Default SMB chart — system accounts referenced by auto-posting rules. */
export const DEFAULT_SMB_COA: CoaSeed[] = [
  { code: '1000', name: 'Cash on Hand', type: 'asset', normalBalance: 'debit' },
  { code: '1010', name: 'Bank', type: 'asset', normalBalance: 'debit' },
  { code: '1050', name: 'Delivery Wallet', type: 'asset', normalBalance: 'debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: '1150', name: 'WIP Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '1200', name: 'Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '1201', name: 'Finished Goods Inventory', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: '2100', name: 'Sales Tax Payable', type: 'liability', normalBalance: 'credit' },
  { code: '3000', name: "Owner's Equity", type: 'equity', normalBalance: 'credit' },
  { code: '3100', name: 'Opening Balance Equity', type: 'equity', normalBalance: 'credit' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit' },
  { code: '6000', name: 'Rent Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6010', name: 'Utilities Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6020', name: 'Payroll Expense', type: 'expense', normalBalance: 'debit' },
  { code: '6099', name: 'General Expense', type: 'expense', normalBalance: 'debit' },
];

export const GL_ACCOUNT_CODES = {
  CASH: '1000',
  BANK: '1010',
  DELIVERY_WALLET: '1050',
  AR: '1100',
  WIP_INVENTORY: '1150',
  INVENTORY: '1200',
  FG_INVENTORY: '1201',
  AP: '2000',
  TAX_PAYABLE: '2100',
  OWNERS_EQUITY: '3000',
  OPENING_EQUITY: '3100',
  REVENUE: '4000',
  COGS: '5000',
  GENERAL_EXPENSE: '6099',
  PAYROLL: '6020',
} as const;

const nowIso = () => new Date().toISOString();

export function buildDefaultLedgerAccounts(storeId: string): Omit<LedgerAccount, 'id'>[] {
  const ts = nowIso();
  return DEFAULT_SMB_COA.map((row) => ({
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

export function ledgerAccountDocId(code: string): string {
  return `acct-${code}`;
}
