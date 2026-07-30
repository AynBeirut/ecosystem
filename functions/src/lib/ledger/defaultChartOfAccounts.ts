import {
  INTERNATIONAL_CHART_OF_ACCOUNTS,
  LEBANESE_CHART_OF_ACCOUNTS,
  resolveChartOfAccounts,
  coaModeVersion,
  normalizeAccountingMode,
  type AccountingMode,
  type CoaSeedRow,
} from './coaTemplates';
import { buildLebanesePcgCoaSeedRows } from './lebanesePcgLedgerSeed';

export const GL_ACCOUNT_CODES = {
  CASH: '102',
  BANK: '106',
  BANK_LBP: '105',
  DELIVERY_WALLET: '103',
  AR: '110',
  WIP_INVENTORY: '123',
  INVENTORY: '120',
  FG_INVENTORY: '121',
  AP: '201',
  INPUT_VAT: '140',
  TAX_PAYABLE: '220',
  OWNERS_EQUITY: '301',
  OPENING_EQUITY: '303',
  REVENUE: '401',
  COGS: '501',
  RENT: '610',
  UTILITIES: '612',
  PAYROLL: '601',
  GENERAL_EXPENSE: '799',
} as const;

/** @deprecated Use INTERNATIONAL_CHART_OF_ACCOUNTS */
export const STANDARD_CHART_OF_ACCOUNTS = INTERNATIONAL_CHART_OF_ACCOUNTS;

/** @deprecated Use INTERNATIONAL_CHART_OF_ACCOUNTS */
export const DEFAULT_SMB_COA = INTERNATIONAL_CHART_OF_ACCOUNTS;

export { INTERNATIONAL_CHART_OF_ACCOUNTS, LEBANESE_CHART_OF_ACCOUNTS, resolveChartOfAccounts, coaModeVersion, normalizeAccountingMode };
export type { AccountingMode, CoaSeedRow };

export type LedgerAccountRow = {
  id: string;
  storeId: string;
  code: string;
  name: string;
  nameAr?: string;
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

const SYSTEM_CODES = new Set<string>(Object.values(GL_ACCOUNT_CODES));

function allSeedRows(mode: AccountingMode): CoaSeedRow[] {
  if (mode !== 'lebanese') return resolveChartOfAccounts(mode);
  const operational = resolveChartOfAccounts('lebanese');
  const pcg = buildLebanesePcgCoaSeedRows();
  const seen = new Set(operational.map((row) => row.code));
  const merged = [...operational];
  for (const row of pcg) {
    if (seen.has(row.code)) continue;
    merged.push(row);
    seen.add(row.code);
  }
  return merged;
}

export function buildDefaultLedgerAccounts(storeId: string, mode: AccountingMode = 'international'): LedgerAccountRow[] {
  const ts = new Date().toISOString();
  return allSeedRows(mode).map((row) => ({
    id: ledgerAccountDocId(row.code),
    storeId,
    code: row.code,
    name: row.name,
    ...(row.nameAr ? { nameAr: row.nameAr } : {}),
    type: row.type,
    normalBalance: row.normalBalance,
    ...(row.parentCode ? { parentCode: row.parentCode } : {}),
    ...(row.pcgKind ? { pcgKind: row.pcgKind } : {}),
    ...(row.currency ? { currency: row.currency } : {}),
    ...(row.grabioOperationalCode ? { grabioOperationalCode: row.grabioOperationalCode } : {}),
    ...(row.isPcgChart ? { isPcgChart: true } : {}),
    isSystem: SYSTEM_CODES.has(row.code),
    isActive: row.defaultActive,
    openingBalance: 0,
    createdAt: ts,
    updatedAt: ts,
  }));
}
