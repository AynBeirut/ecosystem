import { collection, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';

/** True when profile flag is set or any posted journal entry exists. */
export async function resolveAccountingModeLocked(
  db: Firestore,
  storeId: string,
  profile?: { accountingModeLocked?: boolean },
): Promise<boolean> {
  if (profile?.accountingModeLocked === true) return true;
  const snap = await getDocs(
    query(
      collection(db, 'stores', storeId, 'journalEntries'),
      where('status', '==', 'posted'),
      limit(1),
    ),
  );
  return !snap.empty;
}
