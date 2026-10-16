import { createLedgerAccount, loadLedgerAccounts, setLedgerAccountCurrency } from '@/lib/firestore/ledgerFirestore';
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

const PARTY_ACCOUNT_CURRENCIES = ['USD', 'LL'] as const;

function storedPartyCurrency(currency?: string): 'USD' | 'LL' | null {
  const code = String(currency || '').trim().toUpperCase();
  if (code === 'USD') return 'USD';
  if (code === 'LL' || code === 'LBP') return 'LL';
  return null;
}

/** Create the USD account and the LBP account for a client or supplier. Skips a currency that already exists. */
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

  const partyAccounts = accounts.filter(
    (account) => account.partyType === input.kind && account.partyId === input.partyId && account.isActive !== false,
  );
  const blank = partyAccounts.find((account) => !storedPartyCurrency(account.currency));
  if (blank?.id) {
    await setLedgerAccountCurrency(storeId, blank.id, 'LL');
    blank.currency = 'LL';
  }

  const parentCode = partyParentCode(input.kind, mode);
  const grabio = partyGrabioCode(input.kind);
  const usedCodes = new Set([
    ...accounts.map((account) => account.code),
    ...pcgRows.map((row) => row.clientCode),
  ]);
  const parentPcgCode = mapGrabioCodeToPcg(parentCode) || parentCode;
  const isWalkIn = input.partyId === WALK_IN_PARTY_ID;
  const { type, normalBalance } = partyAccountTypeForParent(parentCode);
  const baseName = isWalkIn
    ? 'Walk-in'
    : input.partyName.trim() || (input.kind === 'client' ? 'Client' : 'Supplier');

  let primary: { code: string; created: boolean } | null = null;
  let createdAny = false;

  for (const currency of PARTY_ACCOUNT_CURRENCIES) {
    const ledgerHit = partyAccounts.find((account) => storedPartyCurrency(account.currency) === currency);
    const pcgHit = pcgRows.find(
      (row) => row.partyType === input.kind && row.partyId === input.partyId && storedPartyCurrency(row.currency) === currency,
    );
    const existingCode = String(ledgerHit?.code || pcgHit?.clientCode || '').trim();
    if (existingCode) {
      if (!primary || currency === 'USD') primary = { code: existingCode, created: false };
      continue;
    }

    const code =
      mode === 'lebanese'
        ? isWalkIn && currency === 'LL' && !usedCodes.has(walkInClientPcgCode(parentPcgCode))
          ? walkInClientPcgCode(parentPcgCode)
          : proposePartyClientPcgCode(parentPcgCode, usedCodes)
        : nextSiblingAccountCode(parentCode, [...usedCodes], PARTY_SUFFIX_DIGITS);
    usedCodes.add(code);
    const name = `${baseName} ${currency === 'USD' ? 'USD' : 'LBP'}`;

    await createLedgerAccount(storeId, {
      code,
      name,
      type,
      normalBalance,
      parentCode,
      pcgKind: mode === 'lebanese' ? 'D' : undefined,
      isPcgChart: false,
      grabioOperationalCode: grabio,
      currency,
      partyId: input.partyId,
      partyType: input.kind,
    });

    if (mode === 'lebanese') {
      await savePcgClientAccount(storeId, {
        clientCode: code,
        grabioOperationalCode: grabio,
        parentPcgCode,
        name,
        currency,
        partyId: input.partyId,
        partyType: input.kind,
      });
    }

    createdAny = true;
    if (!primary || currency === 'USD') primary = { code, created: true };
  }

  if (createdAny) notifyLedgerChanged();
  return primary;
}
