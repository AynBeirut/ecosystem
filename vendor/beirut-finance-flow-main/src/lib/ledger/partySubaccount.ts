import { createLedgerAccount, loadLedgerAccounts } from '@/lib/firestore/ledgerFirestore';
import { loadPcgClientAccounts, savePcgClientAccount } from '@/lib/firestore/pcgClientAccountsFirestore';
import { resolveStoreAccountingMode } from '@/lib/grabio/accountingMode';
import { notifyLedgerChanged } from '@/lib/ledger/ledgerChanged';
import { mapGrabioCodeToPcg } from '@/lib/ledger/grabioToPcgMap';
import { proposeClientPcgCode, proposePartyClientPcgCode, walkInClientPcgCode } from '@/lib/ledger/pcgClientCode';
import { nextSiblingAccountCode } from '@/lib/ledger/nextSiblingAccountCode';
import {
  PARTY_SUFFIX_DIGITS,
  WALK_IN_PARTY_ID,
  partyAccountTypeForParent,
  partyGrabioCode,
  partyParentCode,
  type PartyKind,
} from '@/lib/ledger/partySubaccountCodes';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

export type { PartyKind } from '@/lib/ledger/partySubaccountCodes';
export {
  PARTY_AR_PARENT,
  PARTY_AP_PARENT,
  PARTY_CLIENT_PARENT,
  PARTY_GRABIO_AR,
  PARTY_GRABIO_AP,
  PARTY_SUPPLIER_PARENT,
  PARTY_SUFFIX_DIGITS,
  WALK_IN_PARTY_ID,
  partyAccountTypeForKind,
  partyAccountTypeForParent,
  partyGrabioCode,
  partyParentCode,
} from '@/lib/ledger/partySubaccountCodes';

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
  const usedCodes = new Set([
    ...accounts.map((account) => account.code),
    ...pcgRows.map((row) => row.clientCode),
  ]);
  const parentPcgCode = mapGrabioCodeToPcg(parentCode) || parentCode;
  const isWalkIn = input.partyId === WALK_IN_PARTY_ID;
  const code =
    mode === 'lebanese'
      ? isWalkIn
        ? walkInClientPcgCode(parentPcgCode)
        : proposePartyClientPcgCode(parentPcgCode, usedCodes)
      : nextSiblingAccountCode(parentCode, [...usedCodes], PARTY_SUFFIX_DIGITS);
  const { type, normalBalance } = partyAccountTypeForParent(parentCode);
  const name = isWalkIn
    ? 'Walk-in'
    : input.partyName.trim() || (input.kind === 'client' ? 'Client' : 'Supplier');

  await createLedgerAccount(storeId, {
    code,
    name,
    type,
    normalBalance,
    parentCode,
    pcgKind: mode === 'lebanese' ? 'D' : undefined,
    isPcgChart: false,
    grabioOperationalCode: grabio,
    currency: parent?.currency || (mode === 'lebanese' ? 'LL' : undefined),
    partyId: input.partyId,
    partyType: input.kind,
  });

  if (mode === 'lebanese') {
    await savePcgClientAccount(storeId, {
      clientCode: code,
      grabioOperationalCode: grabio,
      parentPcgCode,
      name,
      currency: parent?.currency === 'USD' ? 'USD' : 'LL',
      partyId: input.partyId,
      partyType: input.kind,
    });
  }

  notifyLedgerChanged();
  return { code, created: true };
}
