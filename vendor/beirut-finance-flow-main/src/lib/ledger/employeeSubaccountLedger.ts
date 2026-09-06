import { createLedgerAccount, loadLedgerAccounts } from '@/lib/firestore/ledgerFirestore';
import { loadPcgClientAccounts, savePcgClientAccount } from '@/lib/firestore/pcgClientAccountsFirestore';
import { resolveStoreAccountingMode } from '@/lib/grabio/accountingMode';
import { notifyLedgerChanged } from '@/lib/ledger/ledgerChanged';
import { mapGrabioCodeToPcg } from '@/lib/ledger/grabioToPcgMap';
import { proposeClientPcgCode } from '@/lib/ledger/pcgClientCode';
import { nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';
import {
  EMPLOYEE_PARENT_GRABIO,
  EMPLOYEE_PARENT_PCG,
  EMPLOYEE_SUFFIX_DIGITS,
  PAYROLL_COMPONENT_LABEL,
  employeeAccountType,
  employeePartyKey,
  type PayrollComponentKind,
} from '@/lib/ledger/employeeSubaccountCodes';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

function ledgerAccountByCode(accounts: LedgerAccount[], code: string): LedgerAccount | undefined {
  const trimmed = String(code || '').trim();
  if (!trimmed) return undefined;
  return accounts.find((account) => account.code === trimmed);
}

export function findEmployeeComponentAccount(
  staffId: string,
  component: PayrollComponentKind,
  accounts: LedgerAccount[],
): LedgerAccount | undefined {
  const key = employeePartyKey(staffId, component);
  return accounts.find(
    (account) =>
      account.partyType === 'employee' &&
      account.partyId === key &&
      account.isActive !== false,
  );
}

export async function ensureEmployeeComponentAccount(
  storeId: string,
  staffId: string,
  staffName: string,
  component: PayrollComponentKind,
  accounts: LedgerAccount[],
): Promise<LedgerAccount | null> {
  const id = String(staffId || '').trim();
  if (!storeId.trim() || !id) return null;

  const existing = findEmployeeComponentAccount(id, component, accounts);
  if (existing) return existing;

  const mode = await resolveStoreAccountingMode(storeId);
  const [freshAccounts, pcgRows] = await Promise.all([
    loadLedgerAccounts(storeId),
    loadPcgClientAccounts(storeId),
  ]);
  accounts.length = 0;
  accounts.push(...freshAccounts);

  const hit = findEmployeeComponentAccount(id, component, accounts);
  if (hit) return hit;

  const parentCode = EMPLOYEE_PARENT_GRABIO;
  const parent = ledgerAccountByCode(accounts, parentCode);
  const usedCodes = new Set([
    ...accounts.map((account) => account.code),
    ...pcgRows.map((row) => row.clientCode),
  ]);
  const parentPcgCode = mapGrabioCodeToPcg(parentCode) || EMPLOYEE_PARENT_PCG;
  const code =
    mode === 'lebanese'
      ? proposeClientPcgCode(parentPcgCode, usedCodes)
      : nextSiblingAccountCode(parentCode, [...usedCodes], EMPLOYEE_SUFFIX_DIGITS);
  const { type, normalBalance } = employeeAccountType();
  const label = PAYROLL_COMPONENT_LABEL[component];
  const name = `${staffName.trim() || 'Employee'} — ${label}`;
  const partyId = employeePartyKey(id, component);

  await createLedgerAccount(storeId, {
    code,
    name,
    type,
    normalBalance,
    parentCode,
    pcgKind: mode === 'lebanese' ? 'D' : undefined,
    isPcgChart: false,
    grabioOperationalCode: parentCode,
    currency: parent?.currency || (mode === 'lebanese' ? 'LL' : undefined),
    partyId,
    partyType: 'employee',
  });

  if (mode === 'lebanese') {
    await savePcgClientAccount(storeId, {
      clientCode: code,
      grabioOperationalCode: parentCode,
      parentPcgCode,
      name,
      currency: parent?.currency === 'USD' ? 'USD' : 'LL',
      partyId,
      partyType: 'employee',
    });
  }

  notifyLedgerChanged();
  const reloaded = await loadLedgerAccounts(storeId);
  accounts.length = 0;
  accounts.push(...reloaded);
  return findEmployeeComponentAccount(id, component, accounts);
}

export function mergeEmployeeRowsIntoPcgClients(
  ledgerAccounts: LedgerAccount[],
  pcgClientAccounts: PcgClientAccount[],
): PcgClientAccount[] {
  const seen = new Set(
    pcgClientAccounts.map((row) => `${row.partyType || ''}:${row.partyId || ''}:${row.clientCode}`),
  );
  const extras: PcgClientAccount[] = [];

  for (const account of ledgerAccounts) {
    if (account.partyType !== 'employee' || !account.partyId || account.isActive === false) continue;
    const key = `${account.partyType}:${account.partyId}:${account.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push({
      id: account.id,
      clientCode: account.code,
      grabioOperationalCode: account.grabioOperationalCode || EMPLOYEE_PARENT_GRABIO,
      parentPcgCode: mapGrabioCodeToPcg(account.grabioOperationalCode || EMPLOYEE_PARENT_GRABIO) || EMPLOYEE_PARENT_PCG,
      name: account.name,
      nameAr: account.nameAr,
      currency: account.currency === 'USD' ? 'USD' : 'LL',
      partyId: account.partyId,
      partyType: 'employee',
    });
  }

  return [...pcgClientAccounts, ...extras].sort((a, b) =>
    a.clientCode.localeCompare(b.clientCode, undefined, { numeric: true }),
  );
}
