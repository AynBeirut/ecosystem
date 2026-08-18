import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import { assertPeriodOpenForPost } from '@/lib/ledger/periodLock';
import { journalDateOnly, parseJournalDateInput } from '@/lib/ledger/periodLockCore';
import { normalizeCurrencyCode } from '@/lib/money/currencies';
import { lockAccountingModeOnFirstPost } from '@/lib/grabio/accountingMode';
import { allocateVoucherNumberInTransaction, voucherSerialsRef } from '@/lib/ledger/voucherSerial';
import type {
  JournalEntry,
  JournalLine,
  JournalLineInput,
  LedgerAccount,
  PostJournalInput,
} from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Resolve a store's base currency for GL labeling (multi-currency Phase 1).
 * By design a store calculates in ONE currency — accurate labeling, not FX math.
 * Falls back to USD (never throws).
 */
async function resolveStoreCurrency(storeId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(getFinanceDb(), 'storeProfiles', storeId));
    const data = snap.exists() ? snap.data() || {} : {};
    return normalizeCurrencyCode((data as { mainCurrency?: unknown }).mainCurrency);
  } catch {
    return normalizeCurrencyCode(undefined);
  }
}

export function buildSourceKey(sourceType: string, sourceId: string, event: string): string {
  return `${sourceType}:${sourceId}:${event}`;
}

export function validateBalancedLines(lines: JournalLineInput[]): { valid: boolean; message?: string } {
  if (!lines.length) return { valid: false, message: 'Journal entry requires at least one line.' };
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    const debit = round2(Number(line.debit) || 0);
    const credit = round2(Number(line.credit) || 0);
    if (debit < 0 || credit < 0) return { valid: false, message: 'Amounts cannot be negative.' };
    if (debit > 0 && credit > 0) return { valid: false, message: 'Each line must be debit OR credit, not both.' };
    if (debit === 0 && credit === 0) return { valid: false, message: 'Each line needs a debit or credit amount.' };
    debitTotal += debit;
    creditTotal += credit;
  }
  debitTotal = round2(debitTotal);
  creditTotal = round2(creditTotal);
  if (debitTotal !== creditTotal) {
    return { valid: false, message: `Entry is out of balance (debits ${debitTotal} ≠ credits ${creditTotal}).` };
  }
  return { valid: true };
}

async function findEntryBySourceKey(storeId: string, sourceKey: string): Promise<JournalEntry | null> {
  const snap = await getDocs(
    query(
      collection(getFinanceDb(), 'stores', storeId, 'journalEntries'),
      where('sourceKey', '==', sourceKey),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<JournalEntry, 'id'>) };
}

function getEntryKeyRef(storeId: string, sourceKey: string) {
  return doc(getFinanceDb(), 'stores', storeId, 'journalEntryKeys', sourceKey);
}

async function findEntryByKey(storeId: string, sourceKey: string): Promise<{ entryId: string } | null> {
  const snap = await getDoc(getEntryKeyRef(storeId, sourceKey));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  const entryId = typeof data.entryId === 'string' ? data.entryId : '';
  return entryId ? { entryId } : null;
}

async function seedEntryKey(storeId: string, sourceKey: string, entryId: string): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(
    getEntryKeyRef(storeId, sourceKey),
    {
      storeId,
      sourceKey,
      entryId,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
}

export type PostJournalResult = {
  entryId: string;
  sourceKey: string;
  idempotentReplay: boolean;
  voucherNumber?: string;
};

export async function postJournalEntry(
  input: PostJournalInput,
  accountsById: Map<string, LedgerAccount>,
): Promise<PostJournalResult> {
  const validation = validateBalancedLines(input.lines);
  if (!validation.valid) throw new Error(validation.message || 'Invalid journal lines');

  const event = String(input.event || '').trim();
  if (!event) throw new Error('Journal entry event is required.');

  const sourceId = input.sourceId || `gen-${Date.now()}`;
  const sourceKey = buildSourceKey(input.sourceType, sourceId, event);

  const existingByKey = await findEntryByKey(input.storeId, sourceKey);
  if (existingByKey) {
    return { entryId: existingByKey.entryId, sourceKey, idempotentReplay: true };
  }

  const existing = await findEntryBySourceKey(input.storeId, sourceKey);
  if (existing) {
    await seedEntryKey(input.storeId, sourceKey, existing.id);
    return { entryId: existing.id, sourceKey, idempotentReplay: true };
  }

  await assertPeriodOpenForPost(input.storeId, input.date);

  const entryDateIso = parseJournalDateInput(input.date);
  const entryYear = Number(journalDateOnly(entryDateIso).slice(0, 4));

  // Accurate currency label: caller-provided currency, else the store's base currency.
  const currency = input.currency
    ? normalizeCurrencyCode(input.currency)
    : await resolveStoreCurrency(input.storeId);

  const entryId = `JE-${Date.now()}`;
  const now = new Date().toISOString();

  const lines: JournalLine[] = input.lines.map((line, index) => {
    const account = accountsById.get(line.accountId);
    if (!account || !account.isActive) {
      throw new Error(`Invalid or inactive account: ${line.accountId}`);
    }
    const fxRate = line.fxRate && line.fxRate > 0 ? line.fxRate : undefined;
    const amountFx = line.amountFx && line.amountFx > 0 ? round2(line.amountFx) : undefined;
    return sanitizeForFirestore({
      id: `${entryId}-L${index + 1}`,
      storeId: input.storeId,
      entryId,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      currency,
      debit: round2(Number(line.debit) || 0),
      credit: round2(Number(line.credit) || 0),
      ...(line.description ? { description: line.description } : {}),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.transactionCurrency ? { transactionCurrency: line.transactionCurrency } : {}),
      ...(fxRate ? { fxRate } : {}),
      ...(amountFx ? { amountFx } : {}),
      lineOrder: index,
    }) as JournalLine;
  });

  try {
    const created = await runTransaction(getFinanceDb(), async (tx) => {
      const keyRef = getEntryKeyRef(input.storeId, sourceKey);
      const keySnap = await tx.get(keyRef);
      if (keySnap.exists()) {
        const data = keySnap.data() || {};
        return {
          entryId: typeof data.entryId === 'string' ? data.entryId : entryId,
          idempotentReplay: true,
        };
      }

      let voucherNumber = input.voucherNumber;
      if (input.voucherType && !voucherNumber) {
        const serialRef = voucherSerialsRef(input.storeId);
        const serialSnap = await tx.get(serialRef);
        voucherNumber = allocateVoucherNumberInTransaction(
          tx,
          serialRef,
          serialSnap,
          input.storeId,
          input.voucherType,
          entryYear,
        );
      }

      const isSystemGenerated = input.sourceType !== 'manual' && input.sourceType !== 'adjustment';
      const entry = sanitizeForFirestore({
        id: entryId,
        storeId: input.storeId,
        date: entryDateIso,
        memo: input.memo,
        status: 'posted' as const,
        sourceType: input.sourceType,
        sourceId,
        sourceKey,
        event,
        currency,
        isSystemGenerated,
        postedAt: now,
        ...(input.createdBy ? { createdBy: input.createdBy, postedBy: input.createdBy } : {}),
        createdAt: now,
        updatedAt: now,
        ...(input.voucherType ? { voucherType: input.voucherType } : {}),
        ...(voucherNumber ? { voucherNumber } : {}),
        ...(input.voucherMeta ? { voucherMeta: input.voucherMeta } : {}),
      }) as JournalEntry;

      tx.set(keyRef, {
        storeId: input.storeId,
        sourceKey,
        entryId,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(doc(getFinanceDb(), 'stores', input.storeId, 'journalEntries', entryId), entry);
      for (const line of lines) {
        tx.set(doc(getFinanceDb(), 'stores', input.storeId, 'journalLines', line.id), line);
      }
      return { entryId, idempotentReplay: false, voucherNumber };
    });
    if (!created.idempotentReplay) {
      try {
        await lockAccountingModeOnFirstPost(input.storeId);
      } catch (err) {
        console.warn('[Ledger] accountingModeLocked update skipped', err);
      }
      try {
        const { appendLedgerAuditLog } = await import('@/lib/firestore/ledgerAuditFirestore');
        await appendLedgerAuditLog(input.storeId, 'posted', {
          entryId: created.entryId,
          actorUid: input.createdBy,
        });
      } catch (err) {
        console.warn('[Ledger] audit log append skipped', err);
      }
    }
    return {
      entryId: created.entryId,
      sourceKey,
      idempotentReplay: created.idempotentReplay,
      ...(created.voucherNumber ? { voucherNumber: created.voucherNumber } : {}),
    };
  } catch (error) {
    const replay = await findEntryByKey(input.storeId, sourceKey);
    if (replay) {
      return { entryId: replay.entryId, sourceKey, idempotentReplay: true };
    }
    throw error;
  }
}

/** Opening balance adjustment — Dr/Cr target account vs Opening Balance Equity (3100). */
export async function postOpeningBalanceEntry(
  storeId: string,
  account: LedgerAccount,
  amount: number,
  date: string,
  accountsById: Map<string, LedgerAccount>,
  createdBy?: string,
): Promise<PostJournalResult> {
  const abs = round2(Math.abs(amount));
  if (abs === 0) throw new Error('Opening balance amount must be non-zero.');

  const openingEquity = [...accountsById.values()].find((a) => a.code === '303');
  if (!openingEquity) throw new Error('Opening Balance Equity account (303) is missing.');

  const lines: JournalLineInput[] =
    account.normalBalance === 'debit'
      ? [
          { accountId: account.id, debit: abs, credit: 0, description: 'Opening balance' },
          { accountId: openingEquity.id, debit: 0, credit: abs, description: 'Opening balance offset' },
        ]
      : [
          { accountId: openingEquity.id, debit: abs, credit: 0, description: 'Opening balance offset' },
          { accountId: account.id, debit: 0, credit: abs, description: 'Opening balance' },
        ];

  return postJournalEntry(
    {
      storeId,
      date,
      memo: `Opening balance — ${account.code} ${account.name}`,
      sourceType: 'opening',
      sourceId: account.id,
      event: 'opening-balance',
      createdBy,
      lines,
    },
    accountsById,
  );
}

export async function updateAccountOpeningBalance(
  storeId: string,
  accountId: string,
  openingBalance: number,
): Promise<void> {
  const ref = doc(getFinanceDb(), 'stores', storeId, 'ledgerAccounts', accountId);
  await runTransaction(getFinanceDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Account not found');
    tx.update(ref, { openingBalance: round2(openingBalance), updatedAt: new Date().toISOString() });
  });
}

function buildJournalLinesFromInput(
  entryId: string,
  storeId: string,
  inputLines: JournalLineInput[],
  accountsById: Map<string, LedgerAccount>,
  currency: string,
): JournalLine[] {
  return inputLines.map((line, index) => {
    const account = accountsById.get(line.accountId);
    if (!account || !account.isActive) throw new Error(`Invalid account: ${line.accountId}`);
    return sanitizeForFirestore({
      id: `${entryId}-L${index + 1}`,
      storeId,
      entryId,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      currency,
      debit: round2(Number(line.debit) || 0),
      credit: round2(Number(line.credit) || 0),
      ...(line.description ? { description: line.description } : {}),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.transactionCurrency ? { transactionCurrency: line.transactionCurrency } : {}),
      ...(line.fxRate ? { fxRate: line.fxRate } : {}),
      ...(line.amountFx ? { amountFx: line.amountFx } : {}),
      lineOrder: index,
    }) as JournalLine;
  });
}

/** Save balanced manual voucher as draft — excluded from trial balance until posted. */
export async function saveDraftJournalEntry(
  input: PostJournalInput & {
    voucherType?: PostJournalInput['voucherType'];
    voucherMeta?: PostJournalInput['voucherMeta'];
    draftStatus?: 'draft' | 'pending_approval';
  },
  accountsById: Map<string, LedgerAccount>,
  draftEntryId?: string,
): Promise<{ entryId: string }> {
  const validation = validateBalancedLines(input.lines);
  if (!validation.valid) throw new Error(validation.message || 'Invalid lines');

  const currency = input.currency
    ? normalizeCurrencyCode(input.currency)
    : await resolveStoreCurrency(input.storeId);
  const entryId = draftEntryId || `DRAFT-${Date.now()}`;
  const now = new Date().toISOString();
  const lines = buildJournalLinesFromInput(entryId, input.storeId, input.lines, accountsById, currency);

  const entry = sanitizeForFirestore({
    id: entryId,
    storeId: input.storeId,
    date: input.date,
    memo: input.memo,
    status: (input.draftStatus || 'draft') as JournalEntry['status'],
    sourceType: input.sourceType || 'manual',
    sourceId: input.sourceId || entryId,
    sourceKey: `draft:${entryId}`,
    event: input.event || 'draft',
    currency,
    isSystemGenerated: false,
    createdAt: now,
    updatedAt: now,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    ...(input.voucherType ? { voucherType: input.voucherType } : {}),
    ...(input.voucherMeta ? { voucherMeta: input.voucherMeta } : {}),
  }) as JournalEntry;

  const batch = writeBatch(getFinanceDb());
  batch.set(doc(getFinanceDb(), 'stores', input.storeId, 'journalEntries', entryId), entry);
  for (const line of lines) {
    batch.set(doc(getFinanceDb(), 'stores', input.storeId, 'journalLines', line.id), line);
  }
  await batch.commit();

  const { appendLedgerAuditLog } = await import('@/lib/firestore/ledgerAuditFirestore');
  await appendLedgerAuditLog(input.storeId, input.draftStatus === 'pending_approval' ? 'pending_approval_saved' : 'draft_saved', {
    entryId,
    actorUid: input.createdBy,
  });

  return { entryId };
}

/** Promote draft to posted with voucher serial and idempotent source key. */
export async function postDraftJournalEntry(
  storeId: string,
  draftEntryId: string,
  accountsById: Map<string, LedgerAccount>,
  createdBy?: string,
): Promise<PostJournalResult> {
  const entryRef = doc(getFinanceDb(), 'stores', storeId, 'journalEntries', draftEntryId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) throw new Error('Draft not found.');
  const draft = { id: snap.id, ...(snap.data() as Omit<JournalEntry, 'id'>) };
  if (draft.status !== 'draft' && draft.status !== 'pending_approval') {
    throw new Error('Entry is not a draft.');
  }

  const { getDocs, collection, query, where, deleteDoc } = await import('firebase/firestore');
  const linesSnap = await getDocs(
    query(collection(getFinanceDb(), 'stores', storeId, 'journalLines'), where('entryId', '==', draftEntryId)),
  );
  const lineInputs: JournalLineInput[] = linesSnap.docs.map((d) => {
    const l = d.data() as JournalLine;
    return {
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
      description: l.description,
      costCenterId: l.costCenterId,
      transactionCurrency: l.transactionCurrency,
      fxRate: l.fxRate,
      amountFx: l.amountFx,
    };
  });

  for (const lineDoc of linesSnap.docs) {
    await deleteDoc(lineDoc.ref);
  }
  await deleteDoc(entryRef);

  return postJournalEntry(
    {
      storeId,
      date: draft.date,
      memo: draft.memo,
      sourceType: 'manual',
      sourceId: draftEntryId,
      event: draft.event || 'posted-from-draft',
      createdBy,
      voucherType: draft.voucherType,
      voucherMeta: draft.voucherMeta,
      lines: lineInputs,
    },
    accountsById,
  );
}
