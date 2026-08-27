import { createLedgerAccount, loadLedgerAccounts } from '@/lib/firestore/ledgerFirestore';
import { loadPcgClientAccounts, savePcgClientAccount } from '@/lib/firestore/pcgClientAccountsFirestore';
import { resolveStoreAccountingMode } from '@/lib/grabio/accountingMode';
import { notifyLedgerChanged } from '@/lib/ledger/ledgerChanged';
import { nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';
import {
  partyGrabioCode,
  partyParentCode,
  type PartyKind,
} from '@/lib/ledger/partySubaccountCodes';
import type { LedgerAccount, LedgerAccountType, NormalBalance, PcgClientAccount } from '@/types/generalLedger';

export type { PartyKind } from '@/lib/ledger/partySubaccountCodes';
export {
  PARTY_AR_PARENT,
  PARTY_AP_PARENT,
  PARTY_GRABIO_AR,
  PARTY_GRABIO_AP,
  partyParentCode,
  partyGrabioCode,
} from '@/lib/ledger/partySubaccountCodes';

function accountTypeForKind(kind: PartyKind): { type: LedgerAccountType; normalBalance: NormalBalance } {
  return kind === 'client'
    ? { type: 'asset', normalBalance: 'debit' }
    : { type: 'liability', normalBalance: 'credit' };
}

export function existingPartySubaccount(
  kind: PartyKind,
  partyId: string,
  pcgRows: PcgClientAccount[],
  accounts: LedgerAccount[],
): PcgClientAccount | LedgerAccount | undefined {
  const fromPcg = pcgRows.find((row) => row.partyType === kind && row.partyId === partyId);
  if (fromPcg) return fromPcg;
  return accounts.find((account) => account.partyType === kind && account.partyId === partyId);
}

export async function ensurePartySubaccount(input: {
  storeId: string;
  kind: PartyKind;
  partyId: string;
  partyName: string;
}): Promise<{ code: string; created: boolean } | null> {
  const storeId = input.storeId.trim();
  if (!storeId || !input.partyId) return null;

  const mode = await resolveStoreAccountingMode(storeId);
  const [accounts, pcgRows] = await Promise.all([
    loadLedgerAccounts(storeId),
    loadPcgClientAccounts(storeId),
  ]);

  const existing = existingPartySubaccount(input.kind, input.partyId, pcgRows, accounts);
  if (existing) {
    const code = 'clientCode' in existing ? existing.clientCode : existing.code;
    return { code, created: false };
  }

  const parentCode = partyParentCode(input.kind, mode);
  const grabio = partyGrabioCode(input.kind);
  const parent = accounts.find((account) => account.code === parentCode);
  const usedCodes = [
    ...accounts.map((account) => account.code),
    ...pcgRows.map((row) => row.clientCode),
  ];
  const code = nextSiblingAccountCode(parentCode, usedCodes, 4);
  const { type, normalBalance } = accountTypeForKind(input.kind);
  const name = input.partyName.trim() || (input.kind === 'client' ? 'Client' : 'Supplier');

  await createLedgerAccount(storeId, {
    code,
    name,
    type,
    normalBalance,
    parentCode,
    pcgKind: mode === 'lebanese' ? 'D' : undefined,
    isPcgChart: false,
    grabioOperationalCode: mode === 'lebanese' ? grabio : undefined,
    currency: parent?.currency || (mode === 'lebanese' ? 'LL' : undefined),
    partyId: input.partyId,
    partyType: input.kind,
  });

  if (mode === 'lebanese') {
    await savePcgClientAccount(storeId, {
      clientCode: code,
      grabioOperationalCode: grabio,
      parentPcgCode: parentCode,
      name,
      currency: parent?.currency === 'USD' ? 'USD' : 'LL',
      partyId: input.partyId,
      partyType: input.kind,
    });
  }

  notifyLedgerChanged();
  return { code, created: true };
}
