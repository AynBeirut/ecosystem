import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import type { CheckStatus, JournalEntry } from '@/types/generalLedger';

export async function updateCheckStatus(
  storeId: string,
  entryId: string,
  checkStatus: CheckStatus,
): Promise<void> {
  const ref = doc(getFinanceDb(), 'stores', storeId, 'journalEntries', entryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Journal entry not found.');
  const entry = snap.data() as JournalEntry;
  const now = new Date().toISOString();
  const voucherMeta = {
    ...(entry.voucherMeta && typeof entry.voucherMeta === 'object' ? entry.voucherMeta : {}),
    checkStatus,
  };
  await setDoc(ref, { voucherMeta, updatedAt: now }, { merge: true });
}

export function patchEntryCheckStatus(entry: JournalEntry, checkStatus: CheckStatus): JournalEntry {
  const meta = entry.voucherMeta && typeof entry.voucherMeta === 'object' ? { ...entry.voucherMeta } : {};
  return {
    ...entry,
    voucherMeta: { ...meta, checkStatus },
    updatedAt: new Date().toISOString(),
  };
}
