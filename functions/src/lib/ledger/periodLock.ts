import * as admin from 'firebase-admin';
import {
  assertDateNotInClosedPeriod,
  buildMonthPeriod,
  buildQuarterPeriod,
  type LedgerPeriodClosure,
  type PeriodLockAuditEvent,
  type PeriodLockType,
} from './periodLockCore';

function getDb() {
  return admin.firestore();
}

const nowIso = () => new Date().toISOString();

export type PeriodLockActor = {
  userId: string;
  userEmail?: string;
  userName?: string;
};

function closuresCol(storeId: string) {
  return getDb().collection('stores').doc(storeId).collection('ledgerPeriodClosures');
}

export async function loadPeriodClosures(storeId: string): Promise<LedgerPeriodClosure[]> {
  const snap = await closuresCol(storeId).get();
  return snap.docs
    .map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...(d.data() as Omit<LedgerPeriodClosure, 'id'>) }))
    .sort((a: LedgerPeriodClosure, b: LedgerPeriodClosure) => a.startDate.localeCompare(b.startDate));
}

export async function loadClosedPeriodClosures(storeId: string): Promise<LedgerPeriodClosure[]> {
  const all = await loadPeriodClosures(storeId);
  return all.filter((c) => c.isClosed);
}

export async function assertPeriodOpenForPost(storeId: string, dateIso: string): Promise<void> {
  const closures = await loadClosedPeriodClosures(storeId);
  assertDateNotInClosedPeriod(dateIso, closures, 'post journal entries');
}

export async function assertPeriodOpenForMutation(storeId: string, entryDateIso: string): Promise<void> {
  const closures = await loadClosedPeriodClosures(storeId);
  assertDateNotInClosedPeriod(entryDateIso, closures, 'edit or delete journal entries');
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
  const ref = closuresCol(storeId).doc(period.id);
  const existing = await ref.get();
  const now = nowIso();

  const event: PeriodLockAuditEvent = {
    action: 'close',
    at: now,
    userId: actor.userId,
    ...(actor.userEmail ? { userEmail: actor.userEmail } : {}),
    ...(actor.userName ? { userName: actor.userName } : {}),
    ...(note ? { reason: note } : {}),
  };

  const record: LedgerPeriodClosure = existing.exists
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

  await ref.set(record);
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

  const ref = closuresCol(storeId).doc(periodId);
  const existing = await ref.get();
  if (!existing.exists) throw new Error(`Period ${periodId} was never closed.`);

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

  await ref.set(record);
  return record;
}

export async function updateJournalEntryMemo(
  storeId: string,
  entryId: string,
  memo: string,
): Promise<void> {
  const entryRef = getDb().collection('stores').doc(storeId).collection('journalEntries').doc(entryId);
  const snap = await entryRef.get();
  if (!snap.exists) throw new Error('Journal entry not found.');
  const entry = snap.data() as { date: string };
  await assertPeriodOpenForMutation(storeId, entry.date);
  await entryRef.set({ memo, updatedAt: nowIso() }, { merge: true });
}

export async function deleteJournalEntry(
  storeId: string,
  entryId: string,
): Promise<void> {
  const entryRef = getDb().collection('stores').doc(storeId).collection('journalEntries').doc(entryId);
  const snap = await entryRef.get();
  if (!snap.exists) throw new Error('Journal entry not found.');
  const entry = snap.data() as { date: string };
  await assertPeriodOpenForMutation(storeId, entry.date);

  const linesSnap = await getDb().collection('stores').doc(storeId).collection('journalLines').get();
  const batch = getDb().batch();
  batch.delete(entryRef);
  linesSnap.docs
    .filter((d: FirebaseFirestore.QueryDocumentSnapshot) => d.data().entryId === entryId)
    .forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(d.ref));
  await batch.commit();
}
