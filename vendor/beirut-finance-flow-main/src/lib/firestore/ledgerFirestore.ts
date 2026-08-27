import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import type { JournalEntry, JournalLine, LedgerAccount, LedgerAccountType, LedgerPeriodClosure, NormalBalance } from '@/types/generalLedger';
import {
  buildDefaultLedgerAccounts,
  coaModeVersion,
  ledgerAccountDocId,
} from '@/lib/ledger/defaultChartOfAccounts';
import { resolveStoreAccountingMode } from '@/lib/grabio/accountingMode';
import { notifyLedgerChanged } from '@/lib/ledger/ledgerChanged';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';

const nowIso = () => new Date().toISOString();
const FIRESTORE_BATCH_LIMIT = 400;

async function commitAccountSeeds(storeId: string, seeds: Omit<LedgerAccount, 'id'>[]): Promise<LedgerAccount[]> {
  const db = getFinanceDb();
  const accounts: LedgerAccount[] = [];
  for (let i = 0; i < seeds.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const seed of seeds.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      const id = ledgerAccountDocId(seed.code);
      const account: LedgerAccount = { ...seed, id };
      accounts.push(account);
      batch.set(doc(accountsCol(storeId), id), account);
    }
    await batch.commit();
  }
  return accounts;
}

async function mergeMissingAccountSeeds(
  storeId: string,
  existing: LedgerAccount[],
  mode: Awaited<ReturnType<typeof resolveStoreAccountingMode>>,
): Promise<LedgerAccount[]> {
  const existingCodes = new Set(existing.map((a) => a.code));
  const missing = buildDefaultLedgerAccounts(storeId, mode).filter((seed) => !existingCodes.has(seed.code));
  if (missing.length === 0) return existing;
  const created = await commitAccountSeeds(storeId, missing);
  return [...existing, ...created];
}

function accountsCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'ledgerAccounts');
}

function entriesCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'journalEntries');
}

function linesCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'journalLines');
}

export async function loadLedgerAccounts(storeId: string): Promise<LedgerAccount[]> {
  const snap = await getDocs(accountsCol(storeId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerAccount, 'id'>) }));
}

export async function loadJournalEntries(storeId: string): Promise<JournalEntry[]> {
  const snap = await getDocs(entriesCol(storeId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JournalEntry, 'id'>) }));
}

export async function loadJournalLines(storeId: string): Promise<JournalLine[]> {
  const snap = await getDocs(linesCol(storeId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JournalLine, 'id'>) }));
}

export async function isCoaInitialized(storeId: string): Promise<boolean> {
  const meta = await getDoc(doc(getFinanceDb(), 'stores', storeId, 'ledgerMeta', 'coa'));
  return meta.exists() && meta.data()?.initialized === true;
}

export async function ensureDefaultChartOfAccounts(storeId: string): Promise<LedgerAccount[]> {
  const mode = await resolveStoreAccountingMode(storeId);
  const expectedVersion = coaModeVersion(mode);
  const metaRef = doc(getFinanceDb(), 'stores', storeId, 'ledgerMeta', 'coa');
  const existing = await loadLedgerAccounts(storeId);

  if (existing.length > 0) {
    const merged = await mergeMissingAccountSeeds(storeId, existing, mode);
    await setDoc(
      metaRef,
      {
        storeId,
        initialized: true,
        coaMode: mode,
        coaVersion: expectedVersion,
        accountCount: merged.length,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    return merged;
  }

  const seeds = buildDefaultLedgerAccounts(storeId, mode);
  const accounts = await commitAccountSeeds(storeId, seeds);

  await setDoc(metaRef, {
    storeId,
    initialized: true,
    accountCount: accounts.length,
    coaMode: mode,
    coaVersion: expectedVersion,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return accounts;
}

function normalBalanceForType(type: LedgerAccountType): NormalBalance {
  return type === 'liability' || type === 'equity' || type === 'revenue' ? 'credit' : 'debit';
}

export async function createLedgerAccount(
  storeId: string,
  input: {
    code: string;
    name: string;
    nameAr?: string;
    type: LedgerAccountType;
    normalBalance?: NormalBalance;
    parentCode?: string;
    pcgKind?: string;
    currency?: 'LL' | 'USD';
    isPcgChart?: boolean;
    grabioOperationalCode?: string;
    partyId?: string;
    partyType?: 'client' | 'supplier';
    isSystem?: boolean;
  },
): Promise<LedgerAccount> {
  const code = String(input.code || '').trim();
  const name = String(input.name || '').trim();
  if (!storeId.trim()) throw new Error('Store is required.');
  if (!code) throw new Error('Account code is required.');
  if (!/^[0-9A-Za-z.-]+$/.test(code)) throw new Error('Account code must be letters, digits, dot, or hyphen.');
  if (!name) throw new Error('Account name is required.');

  const id = ledgerAccountDocId(code);
  const ref = doc(accountsCol(storeId), id);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error(`Account code ${code} already exists.`);

  const ts = nowIso();
  const account: LedgerAccount = {
    id,
    storeId,
    code,
    name,
    type: input.type,
    normalBalance: input.normalBalance || normalBalanceForType(input.type),
    isSystem: Boolean(input.isSystem),
    isActive: true,
    openingBalance: 0,
    createdAt: ts,
    updatedAt: ts,
    ...(input.nameAr?.trim() ? { nameAr: input.nameAr.trim() } : {}),
    ...(input.parentCode?.trim() ? { parentCode: input.parentCode.trim() } : {}),
    ...(input.pcgKind ? { pcgKind: input.pcgKind } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
    ...(input.isPcgChart ? { isPcgChart: true } : {}),
    ...(input.grabioOperationalCode?.trim() ? { grabioOperationalCode: input.grabioOperationalCode.trim() } : {}),
    ...(input.partyId?.trim() ? { partyId: input.partyId.trim() } : {}),
    ...(input.partyType ? { partyType: input.partyType } : {}),
  };

  const { id: _id, ...body } = account;
  await setDoc(ref, sanitizeForFirestore(body as unknown as Record<string, unknown>));
  notifyLedgerChanged();
  return account;
}

export async function updateLedgerAccountNames(
  storeId: string,
  accountId: string,
  patch: { name?: string; nameAr?: string },
): Promise<void> {
  const ref = doc(getFinanceDb(), 'stores', storeId, 'ledgerAccounts', accountId);
  await updateDoc(ref, {
    ...patch,
    updatedAt: nowIso(),
  });
}

function closuresCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'ledgerPeriodClosures');
}

export async function loadPeriodClosures(storeId: string): Promise<LedgerPeriodClosure[]> {
  const snap = await getDocs(closuresCol(storeId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerPeriodClosure, 'id'>) }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function loadLedgerBundle(storeId: string) {
  const [accounts, entries, lines, periodClosures] = await Promise.all([
    loadLedgerAccounts(storeId),
    loadJournalEntries(storeId),
    loadJournalLines(storeId),
    loadPeriodClosures(storeId),
  ]);
  return { accounts, entries, lines, periodClosures };
}
