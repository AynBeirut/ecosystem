import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { postJournalEntry, type PostJournalResult } from '@/lib/ledger/postingService';
import { appendLedgerAuditLog } from '@/lib/firestore/ledgerAuditFirestore';
import type { JournalEntry, JournalLine, JournalLineInput, LedgerAccount } from '@/types/generalLedger';

export async function postReversalEntry(
  storeId: string,
  originalEntryId: string,
  accountsById: Map<string, LedgerAccount>,
  createdBy?: string,
): Promise<PostJournalResult> {
  const entryRef = doc(getFinanceDb(), 'stores', storeId, 'journalEntries', originalEntryId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) throw new Error('Original entry not found.');
  const original = { id: snap.id, ...(snap.data() as Omit<JournalEntry, 'id'>) };
  if (original.status !== 'posted') throw new Error('Only posted entries can be reversed.');
  if (original.reversalOfEntryId) throw new Error('Cannot reverse a reversal entry.');

  const linesSnap = await getDocs(
    query(collection(getFinanceDb(), 'stores', storeId, 'journalLines'), where('entryId', '==', originalEntryId)),
  );
  const reversedLines: JournalLineInput[] = linesSnap.docs.map((d) => {
    const l = d.data() as JournalLine;
    return {
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
      description: l.description ? `Reversal: ${l.description}` : 'Reversal',
      costCenterId: l.costCenterId,
      transactionCurrency: l.transactionCurrency,
      fxRate: l.fxRate,
      amountFx: l.amountFx,
    };
  });

  const result = await postJournalEntry(
    {
      storeId,
      date: new Date().toISOString(),
      memo: `Reversal of ${original.voucherNumber || original.id}`,
      sourceType: 'reversal',
      sourceId: originalEntryId,
      event: 'storno',
      createdBy,
      voucherType: original.voucherType,
      lines: reversedLines,
    },
    accountsById,
  );

  if (!result.idempotentReplay) {
    const { setDoc } = await import('firebase/firestore');
    const now = new Date().toISOString();
    await setDoc(
      doc(getFinanceDb(), 'stores', storeId, 'journalEntries', result.entryId),
      { reversalOfEntryId: originalEntryId, updatedAt: now },
      { merge: true },
    );
    await setDoc(
      entryRef,
      { status: 'reversed', updatedAt: now },
      { merge: true },
    );
    await appendLedgerAuditLog(storeId, 'reversed', { entryId: originalEntryId, actorUid: createdBy });
  }

  return result;
}
