import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import type { BankRecSession, BankRecMatch, BankStatementLine, LedgerAccount } from '@/types/generalLedger';
import type { ParsedStatementRow } from '@/lib/ledger/bankRecCsv';

const nowIso = () => new Date().toISOString();

function sessionsCol(storeId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'bankRecSessions');
}

function sessionDocId(accountCode: string, startDate: string, endDate: string): string {
  return `BR-${accountCode}-${startDate}-${endDate}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function linesCol(storeId: string, sessionId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'bankRecSessions', sessionId, 'statementLines');
}

async function assertSessionEditable(storeId: string, sessionId: string): Promise<void> {
  const snap = await getDoc(doc(sessionsCol(storeId), sessionId));
  if (!snap.exists()) throw new Error('Session not found');
  if ((snap.data() as BankRecSession).status === 'locked') {
    throw new Error('This reconciliation is locked.');
  }
}

function matchesCol(storeId: string, sessionId: string) {
  return collection(getFinanceDb(), 'stores', storeId, 'bankRecSessions', sessionId, 'bankRecMatches');
}

export async function loadOrCreateBankRecSession(
  storeId: string,
  account: LedgerAccount,
  startDate: string,
  endDate: string,
): Promise<BankRecSession> {
  const id = sessionDocId(account.code, startDate.slice(0, 10), endDate.slice(0, 10));
  const ref = doc(sessionsCol(storeId), id);
  const snap = await getDoc(ref);
  const now = nowIso();

  if (snap.exists()) {
    return { id, ...(snap.data() as Omit<BankRecSession, 'id'>) };
  }

  const session: BankRecSession = sanitizeForFirestore({
    id,
    storeId,
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    startDate: startDate.slice(0, 10),
    endDate: endDate.slice(0, 10),
    status: 'draft',
    phase: 3,
    createdAt: now,
    updatedAt: now,
  }) as BankRecSession;

  await setDoc(ref, session);
  return session;
}

export async function loadStatementLines(storeId: string, sessionId: string): Promise<BankStatementLine[]> {
  const snap = await getDocs(linesCol(storeId, sessionId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BankStatementLine, 'id'>) }))
    .sort((a, b) => a.lineDate.localeCompare(b.lineDate) || a.createdAt.localeCompare(b.createdAt));
}

export async function addStatementLine(
  storeId: string,
  sessionId: string,
  input: Omit<ParsedStatementRow, 'source'> & { source?: BankStatementLine['source'] },
): Promise<BankStatementLine> {
  await assertSessionEditable(storeId, sessionId);
  const id = `BSL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const now = nowIso();
  const line: BankStatementLine = sanitizeForFirestore({
    id,
    sessionId,
    storeId,
    lineDate: input.lineDate.slice(0, 10),
    debit: input.debit,
    credit: input.credit,
    description: input.description.trim() || 'Statement line',
    reference: input.reference?.trim() || undefined,
    source: input.source || 'manual',
    createdAt: now,
    updatedAt: now,
  }) as BankStatementLine;

  await setDoc(doc(linesCol(storeId, sessionId), id), line);
  await setDoc(
    doc(sessionsCol(storeId), sessionId),
    sanitizeForFirestore({ updatedAt: now }),
    { merge: true },
  );
  return line;
}

export async function importStatementLines(
  storeId: string,
  sessionId: string,
  rows: ParsedStatementRow[],
): Promise<number> {
  if (!rows.length) return 0;
  await assertSessionEditable(storeId, sessionId);
  const batch = writeBatch(getFinanceDb());
  const now = nowIso();
  let count = 0;
  for (const row of rows) {
    const id = `BSL-${Date.now()}-${count}-${Math.floor(Math.random() * 1000)}`;
    const line: BankStatementLine = sanitizeForFirestore({
      id,
      sessionId,
      storeId,
      lineDate: row.lineDate,
      debit: row.debit,
      credit: row.credit,
      description: row.description,
      reference: row.reference,
      source: row.source,
      createdAt: now,
      updatedAt: now,
    }) as BankStatementLine;
    batch.set(doc(linesCol(storeId, sessionId), id), line);
    count += 1;
  }
  batch.set(doc(sessionsCol(storeId), sessionId), sanitizeForFirestore({ updatedAt: now }), { merge: true });
  await batch.commit();
  return count;
}

export async function deleteStatementLine(storeId: string, sessionId: string, lineId: string): Promise<void> {
  await assertSessionEditable(storeId, sessionId);
  const matchSnap = await getDocs(matchesCol(storeId, sessionId));
  const batch = writeBatch(getFinanceDb());
  for (const m of matchSnap.docs) {
    if (m.data().statementLineId === lineId) batch.delete(m.ref);
  }
  batch.delete(doc(linesCol(storeId, sessionId), lineId));
  batch.set(
    doc(sessionsCol(storeId), sessionId),
    sanitizeForFirestore({ updatedAt: nowIso() }),
    { merge: true },
  );
  await batch.commit();
}

export async function loadBankRecMatches(storeId: string, sessionId: string): Promise<BankRecMatch[]> {
  const snap = await getDocs(matchesCol(storeId, sessionId));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BankRecMatch, 'id'>) }))
    .sort((a, b) => a.matchedAt.localeCompare(b.matchedAt));
}

export async function createBankRecMatch(
  storeId: string,
  sessionId: string,
  input: { statementLineId: string; bookLineId: string; matchType: BankRecMatch['matchType']; matchedBy?: string },
): Promise<BankRecMatch> {
  await assertSessionEditable(storeId, sessionId);
  const existing = await getDocs(matchesCol(storeId, sessionId));
  for (const d of existing.docs) {
    const data = d.data();
    if (data.statementLineId === input.statementLineId || data.bookLineId === input.bookLineId) {
      throw new Error('Statement or book line is already matched.');
    }
  }

  const id = `BRM-${Date.now()}`;
  const now = nowIso();
  const match: BankRecMatch = sanitizeForFirestore({
    id,
    sessionId,
    storeId,
    statementLineId: input.statementLineId,
    bookLineId: input.bookLineId,
    matchType: input.matchType,
    matchedAt: now,
    ...(input.matchedBy ? { matchedBy: input.matchedBy } : {}),
  }) as BankRecMatch;

  await setDoc(doc(matchesCol(storeId, sessionId), id), match);
  await setDoc(doc(sessionsCol(storeId), sessionId), sanitizeForFirestore({ updatedAt: now }), { merge: true });
  return match;
}

export async function deleteBankRecMatch(storeId: string, sessionId: string, matchId: string): Promise<void> {
  await assertSessionEditable(storeId, sessionId);
  await deleteDoc(doc(matchesCol(storeId, sessionId), matchId));
  await setDoc(
    doc(sessionsCol(storeId), sessionId),
    sanitizeForFirestore({ updatedAt: nowIso() }),
    { merge: true },
  );
}

export async function createBankRecMatchesBatch(
  storeId: string,
  sessionId: string,
  pairs: Array<{ statementLineId: string; bookLineId: string }>,
  matchType: BankRecMatch['matchType'],
  matchedBy?: string,
): Promise<number> {
  if (!pairs.length) return 0;
  await assertSessionEditable(storeId, sessionId);
  const existing = await loadBankRecMatches(storeId, sessionId);
  const usedStmt = new Set(existing.map((m) => m.statementLineId));
  const usedBook = new Set(existing.map((m) => m.bookLineId));

  const batch = writeBatch(getFinanceDb());
  const now = nowIso();
  let count = 0;
  for (const pair of pairs) {
    if (usedStmt.has(pair.statementLineId) || usedBook.has(pair.bookLineId)) continue;
    const id = `BRM-${Date.now()}-${count}`;
    const match: BankRecMatch = sanitizeForFirestore({
      id,
      sessionId,
      storeId,
      statementLineId: pair.statementLineId,
      bookLineId: pair.bookLineId,
      matchType,
      matchedAt: now,
      ...(matchedBy ? { matchedBy } : {}),
    }) as BankRecMatch;
    batch.set(doc(matchesCol(storeId, sessionId), id), match);
    usedStmt.add(pair.statementLineId);
    usedBook.add(pair.bookLineId);
    count += 1;
  }
  batch.set(doc(sessionsCol(storeId), sessionId), sanitizeForFirestore({ updatedAt: now }), { merge: true });
  await batch.commit();
  return count;
}

export async function updateBankRecSession(
  storeId: string,
  sessionId: string,
  patch: Partial<Pick<BankRecSession, 'statementOpeningBalance' | 'status' | 'lockedAt' | 'lockedBy'>>,
): Promise<void> {
  const ref = doc(sessionsCol(storeId), sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found');
  const data = snap.data() as BankRecSession;
  if (data.status === 'locked') throw new Error('Session is locked.');
  await setDoc(
    ref,
    sanitizeForFirestore({ ...patch, updatedAt: nowIso() }),
    { merge: true },
  );
}

export async function lockBankRecSession(
  storeId: string,
  sessionId: string,
  lockedBy?: string,
): Promise<BankRecSession> {
  const ref = doc(sessionsCol(storeId), sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Session not found');
  const data = snap.data() as BankRecSession;
  if (data.status === 'locked') return { id: sessionId, ...data };
  const now = nowIso();
  const patch = {
    status: 'locked' as const,
    lockedAt: now,
    ...(lockedBy ? { lockedBy } : {}),
    updatedAt: now,
    phase: 3 as const,
  };
  await setDoc(ref, sanitizeForFirestore(patch), { merge: true });
  return { id: sessionId, ...data, ...patch };
}
