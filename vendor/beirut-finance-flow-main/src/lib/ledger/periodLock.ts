import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { LedgerPeriodClosure, PeriodLockAuditEvent, PeriodLockType } from '@/types/generalLedger';
import {
  assertDateNotInClosedPeriod,
  buildMonthPeriod,
  buildQuarterPeriod,
  journalDateOnly,
} from '@/lib/ledger/periodLockCore';

const nowIso = () => new Date().toISOString();

function closuresCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'ledgerPeriodClosures');
}

export type PeriodLockActor = {
  userId: string;
  userEmail?: string;
  userName?: string;
};

export async function loadPeriodClosures(storeId: string): Promise<LedgerPeriodClosure[]> {
  const snap = await getDocs(closuresCol(storeId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerPeriodClosure, 'id'>) }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export async function loadClosedPeriodClosures(storeId: string): Promise<LedgerPeriodClosure[]> {
  const all = await loadPeriodClosures(storeId);
  return all.filter((c) => c.isClosed);
}

export async function assertPeriodOpenForPost(storeId: string, dateIso: string): Promise<void> {
  const closures = await loadClosedPeriodClosures(storeId);
  assertDateNotInClosedPeriod(dateIso, closures, 'post journal entries', journalDateOnly(new Date().toISOString()));
}

export async function assertPeriodOpenForMutation(storeId: string, entryDateIso: string): Promise<void> {
  const closures = await loadClosedPeriodClosures(storeId);
  assertDateNotInClosedPeriod(entryDateIso, closures, 'edit or delete journal entries', journalDateOnly(new Date().toISOString()));
}

function resolvePeriod(
  periodType: PeriodLockType,
  year: number,
  monthOrQuarter: number,
) {
  return periodType === 'month'
    ? buildMonthPeriod(year, monthOrQuarter)
    : buildQuarterPeriod(year, monthOrQuarter);
}

export async function closeLedgerPeriod(
  storeId: string,
  periodType: PeriodLockType,
  year: number,
  monthOrQuarter: number,
  actor: PeriodLockActor,
  note?: string,
): Promise<LedgerPeriodClosure> {
  const period = resolvePeriod(periodType, year, monthOrQuarter);
  const ref = doc(closuresCol(storeId), period.id);
  const existing = await getDoc(ref);
  const now = nowIso();

  const event: PeriodLockAuditEvent = {
    action: 'close',
    at: now,
    userId: actor.userId,
    ...(actor.userEmail ? { userEmail: actor.userEmail } : {}),
    ...(actor.userName ? { userName: actor.userName } : {}),
    ...(note ? { reason: note } : {}),
  };

  const record: LedgerPeriodClosure = existing.exists()
    ? {
        ...(existing.data() as Omit<LedgerPeriodClosure, 'id'>),
        id: period.id,
        isClosed: true,
        history: [...((existing.data() as LedgerPeriodClosure).history || []), event],
        updatedAt: now,
      }
    : {
        id: period.id,
        storeId,
        periodType: period.periodType,
        startDate: period.startDate,
        endDate: period.endDate,
        label: period.label,
        isClosed: true,
        history: [event],
        createdAt: now,
        updatedAt: now,
      };

  await setDoc(ref, sanitizeForFirestore(record));
  return record;
}

export async function reopenLedgerPeriod(
  storeId: string,
  periodId: string,
  actor: PeriodLockActor,
  reason: string,
): Promise<LedgerPeriodClosure> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('Reopen reason is required.');

  const ref = doc(closuresCol(storeId), periodId);
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error(`Period ${periodId} was never closed.`);

  const now = nowIso();
  const event: PeriodLockAuditEvent = {
    action: 'reopen',
    at: now,
    userId: actor.userId,
    reason: trimmed,
    ...(actor.userEmail ? { userEmail: actor.userEmail } : {}),
    ...(actor.userName ? { userName: actor.userName } : {}),
  };

  const prev = existing.data() as Omit<LedgerPeriodClosure, 'id'>;
  const record: LedgerPeriodClosure = {
    ...prev,
    id: periodId,
    isClosed: false,
    history: [...(prev.history || []), event],
    updatedAt: now,
  };

  await setDoc(ref, sanitizeForFirestore(record));
  return record;
}

export async function updateJournalEntryMemo(
  storeId: string,
  entryId: string,
  memo: string,
): Promise<void> {
  const entryRef = doc(getFinanceDb(), 'stores', storeId, 'journalEntries', entryId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) throw new Error('Journal entry not found.');
  const entry = snap.data() as { date: string };
  await assertPeriodOpenForMutation(storeId, entry.date);
  await setDoc(entryRef, { memo, updatedAt: nowIso() }, { merge: true });
}

export async function deleteJournalEntry(
  storeId: string,
  entryId: string,
): Promise<void> {
  const entryRef = doc(getFinanceDb(), 'stores', storeId, 'journalEntries', entryId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) throw new Error('Journal entry not found.');
  const entry = snap.data() as { date: string; status?: string };
  await assertPeriodOpenForMutation(storeId, entry.date);
  if (entry.status === 'posted' || entry.status === 'reversed') {
    throw new Error('Posted entries cannot be deleted. Use Reverse instead.');
  }

  const linesSnap = await getDocs(collection(getFinanceDb(), 'stores', storeId, 'journalLines'));
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(getFinanceDb());
  batch.delete(entryRef);
  linesSnap.docs
    .filter((d) => d.data().entryId === entryId)
    .forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
