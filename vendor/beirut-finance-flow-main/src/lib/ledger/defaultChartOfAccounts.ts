import type { LedgerAccountType, NormalBalance } from '@/types/generalLedger';
import {
  INTERNATIONAL_CHART_OF_ACCOUNTS,
  LEBANESE_CHART_OF_ACCOUNTS,
  resolveChartOfAccounts,
  coaModeVersion,
  normalizeAccountingMode,
  type AccountingMode,
  type CoaSeedRow,
} from './coaTemplates';
import { GRABIO_TO_PCG_CODE } from './grabioToPcgMap';
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

export {
  INTERNATIONAL_CHART_OF_ACCOUNTS,
  LEBANESE_CHART_OF_ACCOUNTS,
  resolveChartOfAccounts,
  coaModeVersion,
  normalizeAccountingMode,
};
export type { AccountingMode, CoaSeedRow };

const SYSTEM_CODES = new Set<string>(Object.values(GL_ACCOUNT_CODES));

const nowIso = () => new Date().toISOString();

const pcgToGrabio = new Map<string, string>();
for (const [grabio, pcg] of Object.entries(GRABIO_TO_PCG_CODE)) {
  if (!pcgToGrabio.has(pcg)) pcgToGrabio.set(pcg, grabio);
}

function withGrabioOperationalLinks(rows: CoaSeedRow[]): CoaSeedRow[] {
  return rows.map((row) => {
    if (!row.isPcgChart) return row;
    const grabioOperationalCode = pcgToGrabio.get(row.code);
    return grabioOperationalCode ? { ...row, grabioOperationalCode } : row;
  });
}

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
  return withGrabioOperationalLinks(merged);
}

export function buildDefaultLedgerAccounts(
  storeId: string,
  mode: AccountingMode = 'international',
): Omit<import('@/types/generalLedger').LedgerAccount, 'id'>[] {
  const ts = nowIso();
  return allSeedRows(mode).map((row) => ({
    storeId,
    code: row.code,
    name: row.name,
    ...(row.nameAr ? { nameAr: row.nameAr } : {}),
    type: row.type as LedgerAccountType,
    normalBalance: row.normalBalance as NormalBalance,
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

export function ledgerAccountDocId(code: string): string {
  return `acct-${code}`;
}
