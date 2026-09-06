import { loadLedgerAccounts } from '@/lib/firestore/ledgerFirestore';
import { loadPcgClientAccounts } from '@/lib/firestore/pcgClientAccountsFirestore';
import { mapGrabioCodeToPcg } from '@/lib/ledger/grabioToPcgMap';
import {
  ensurePartySubaccount,
  existingPartySubaccount,
  partyParentCode,
  WALK_IN_PARTY_ID,
  type PartyKind,
} from '@/lib/ledger/partySubaccount';
import type { LedgerAccount, PcgClientAccount } from '@/types/generalLedger';

const WALK_IN_RE = /walk[- ]?in|cash\s*customer|anonymous|pos\s*customer|guest|counter\s*sale/i;

export { WALK_IN_PARTY_ID } from '@/lib/ledger/partySubaccountCodes';

export function isWalkInClient(clientId?: string, clientName?: string): boolean {
  if (String(clientId || '').trim() === WALK_IN_PARTY_ID) return true;
  if (String(clientId || '').trim()) return false;
  const name = String(clientName || '').trim();
  if (!name) return true;
  return WALK_IN_RE.test(name);
}

export function walkInPartyIdForPosting(clientId?: string, clientName?: string): string {
  return isWalkInClient(clientId, clientName) ? WALK_IN_PARTY_ID : String(clientId || '').trim();
}

export function ledgerAccountByCode(accounts: LedgerAccount[], code: string): LedgerAccount | undefined {
  const trimmed = String(code || '').trim();
  if (!trimmed) return undefined;
  return accounts.find((account) => account.code === trimmed);
}

export function ledgerAccountForParty(
  kind: PartyKind,
  partyId: string,
  accounts: LedgerAccount[],
  pcgRows: PcgClientAccount[] = [],
): LedgerAccount | undefined {
  const id = String(partyId || '').trim();
  if (!id) return undefined;
  const hit = accounts.find((account) => account.partyType === kind && account.partyId === id);
  if (hit) return hit;
  const pcg = existingPartySubaccount(kind, id, pcgRows, accounts);
  if (!pcg) return undefined;
  const code = 'clientCode' in pcg ? pcg.clientCode : pcg.code;
  return ledgerAccountByCode(accounts, code);
}

/** Ensure party subaccount exists and return its ledger row (mutates `accounts` when a new row is loaded). */
export async function ensurePartyLedgerAccount(
  storeId: string,
  kind: PartyKind,
  partyId: string,
  partyName: string,
  accounts: LedgerAccount[],
): Promise<LedgerAccount | null> {
  const id = String(partyId || '').trim();
  if (!storeId.trim() || !id) return null;

  const existing = accounts.find((account) => account.partyType === kind && account.partyId === id);
  if (existing) return existing;

  const ensured = await ensurePartySubaccount({
    storeId,
    kind,
    partyId: id,
    partyName: partyName.trim() || (kind === 'client' ? 'Client' : 'Supplier'),
  });
  if (!ensured?.code) return null;

  let account = ledgerAccountByCode(accounts, ensured.code);
  if (account) return account;

  const fresh = await loadLedgerAccounts(storeId);
  accounts.length = 0;
  accounts.push(...fresh);
  account = ledgerAccountByCode(accounts, ensured.code);
  return account || null;
}

function ledgerRowToPcgClient(account: LedgerAccount): PcgClientAccount {
  const parentGrabio = account.parentCode || partyParentCode(account.partyType as PartyKind);
  return {
    id: account.id,
    clientCode: account.code,
    grabioOperationalCode: account.grabioOperationalCode || parentGrabio,
    parentPcgCode: mapGrabioCodeToPcg(parentGrabio) || parentGrabio,
    name: account.name,
    nameAr: account.nameAr,
    currency: account.currency === 'USD' ? 'USD' : 'LL',
    partyId: account.partyId,
    partyType: account.partyType,
  };
}

/**
 * One working account number → one row in the COA tree.
 * Never show two party names on the same clientCode (migration/merge safety).
 */
export function mergeLedgerPartyRowsIntoPcgClients(
  ledgerAccounts: LedgerAccount[],
  pcgClientAccounts: PcgClientAccount[],
): PcgClientAccount[] {
  const pcgCollectionIds = new Set(pcgClientAccounts.map((row) => row.id));
  const byParty = new Map<string, PcgClientAccount>();
  const byCode = new Map<string, PcgClientAccount>();

  const register = (row: PcgClientAccount, fromPcgCollection = false) => {
    const code = String(row.clientCode || '').trim();
    if (!code) return;
    const partyKey =
      row.partyType && row.partyId ? `${row.partyType}:${row.partyId}` : '';

    const existing = byCode.get(code);
    if (existing) {
      const existingFromPcg = pcgCollectionIds.has(existing.id);
      const incomingFromPcg = fromPcgCollection && pcgCollectionIds.has(row.id);
      if (incomingFromPcg && !existingFromPcg) {
        byCode.set(code, row);
        if (partyKey) byParty.set(partyKey, row);
      }
      return;
    }

    byCode.set(code, row);
    if (partyKey) byParty.set(partyKey, row);
  };

  for (const row of pcgClientAccounts) register(row, true);

  for (const account of ledgerAccounts) {
    if (!account.partyType || !account.partyId || account.isActive === false) continue;
    const partyKey = `${account.partyType}:${account.partyId}`;
    if (byParty.has(partyKey)) continue;

    const code = String(account.code || '').trim();
    if (!code || byCode.has(code)) continue;

    register(ledgerRowToPcgClient(account), false);
  }

  return [...byCode.values()].sort((a, b) =>
    a.clientCode.localeCompare(b.clientCode, undefined, { numeric: true }),
  );
}

export async function loadPartyPcgRows(storeId: string): Promise<{
  accounts: LedgerAccount[];
  pcgRows: PcgClientAccount[];
}> {
  const [accounts, pcgRows] = await Promise.all([
    loadLedgerAccounts(storeId),
    loadPcgClientAccounts(storeId),
  ]);
  return {
    accounts,
    pcgRows: mergeLedgerPartyRowsIntoPcgClients(accounts, pcgRows),
  };
}
