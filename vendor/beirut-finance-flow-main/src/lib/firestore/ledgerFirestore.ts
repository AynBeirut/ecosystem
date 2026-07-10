import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import type { JournalEntry, JournalLine, LedgerAccount, LedgerPeriodClosure } from '@/types/generalLedger';
import {
  buildDefaultLedgerAccounts,
  ledgerAccountDocId,
} from '@/lib/ledger/defaultChartOfAccounts';

const nowIso = () => new Date().toISOString();

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
  const existing = await loadLedgerAccounts(storeId);
  if (existing.length > 0) {
    const existingCodes = new Set(existing.map((a) => a.code));
    const missing = buildDefaultLedgerAccounts(storeId).filter((seed) => !existingCodes.has(seed.code));
    if (missing.length > 0) {
      const batch = writeBatch(getFinanceDb());
      for (const seed of missing) {
        const id = ledgerAccountDocId(seed.code);
        const account: LedgerAccount = { ...seed, id };
        batch.set(doc(accountsCol(storeId), id), account);
        existing.push(account);
      }
      await batch.commit();
    }
    await setDoc(
      doc(getFinanceDb(), 'stores', storeId, 'ledgerMeta', 'coa'),
      { storeId, initialized: true, updatedAt: nowIso() },
      { merge: true },
    );
    return existing;
  }

  const seeds = buildDefaultLedgerAccounts(storeId);
  const batch = writeBatch(getFinanceDb());
  const accounts: LedgerAccount[] = [];

  for (const seed of seeds) {
    const id = ledgerAccountDocId(seed.code);
    const account: LedgerAccount = { ...seed, id };
    accounts.push(account);
    batch.set(doc(accountsCol(storeId), id), account);
  }

  batch.set(doc(getFinanceDb(), 'stores', storeId, 'ledgerMeta', 'coa'), {
    storeId,
    initialized: true,
    accountCount: accounts.length,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await batch.commit();
  return accounts;
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
