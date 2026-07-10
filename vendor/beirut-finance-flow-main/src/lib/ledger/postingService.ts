import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { sanitizeForFirestore } from '@/lib/firestore/storeCollection';
import { assertPeriodOpenForPost } from '@/lib/ledger/periodLock';
import type {
  JournalEntry,
  JournalLine,
  JournalLineInput,
  LedgerAccount,
  PostJournalInput,
} from '@/types/generalLedger';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

export type PostJournalResult = {
  entryId: string;
  sourceKey: string;
  idempotentReplay: boolean;
};

export async function postJournalEntry(
  input: PostJournalInput,
  accountsById: Map<string, LedgerAccount>,
): Promise<PostJournalResult> {
  const validation = validateBalancedLines(input.lines);
  if (!validation.valid) throw new Error(validation.message || 'Invalid journal lines');

  const sourceId = input.sourceId || `gen-${Date.now()}`;
  const sourceKey = buildSourceKey(input.sourceType, sourceId, input.event);

  const existing = await findEntryBySourceKey(input.storeId, sourceKey);
  if (existing) {
    return { entryId: existing.id, sourceKey, idempotentReplay: true };
  }

  await assertPeriodOpenForPost(input.storeId, input.date);

  const entryId = `JE-${Date.now()}`;
  const now = new Date().toISOString();
  const entry = sanitizeForFirestore({
    id: entryId,
    storeId: input.storeId,
    date: input.date,
    memo: input.memo,
    status: 'posted' as const,
    sourceType: input.sourceType,
    sourceId,
    sourceKey,
    currency: input.currency || 'USD',
    createdAt: now,
    updatedAt: now,
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  }) as JournalEntry;

  const lines: JournalLine[] = input.lines.map((line, index) => {
    const account = accountsById.get(line.accountId);
    if (!account || !account.isActive) {
      throw new Error(`Invalid or inactive account: ${line.accountId}`);
    }
    return sanitizeForFirestore({
      id: `${entryId}-L${index + 1}`,
      storeId: input.storeId,
      entryId,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      debit: round2(Number(line.debit) || 0),
      credit: round2(Number(line.credit) || 0),
      ...(line.description ? { description: line.description } : {}),
      lineOrder: index,
    }) as JournalLine;
  });

  const batch = writeBatch(getFinanceDb());
  batch.set(doc(getFinanceDb(), 'stores', input.storeId, 'journalEntries', entryId), entry);
  for (const line of lines) {
    batch.set(doc(getFinanceDb(), 'stores', input.storeId, 'journalLines', line.id), line);
  }
  await batch.commit();

  return { entryId, sourceKey, idempotentReplay: false };
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

  const openingEquity = [...accountsById.values()].find((a) => a.code === '3100');
  if (!openingEquity) throw new Error('Opening Balance Equity account (3100) is missing.');

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
