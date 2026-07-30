import * as admin from 'firebase-admin';
import { normalizeAccountingMode } from './coaTemplates';
import { buildDefaultLedgerAccounts, coaModeVersion } from './defaultChartOfAccounts';

function getDb() {
  return admin.firestore();
}

export async function resolveStoreAccountingMode(storeId: string): Promise<'international' | 'lebanese'> {
  try {
    const snap = await getDb().collection('storeProfiles').doc(storeId).get();
    const data = snap.exists ? snap.data() || {} : {};
    return normalizeAccountingMode((data as { accountingMode?: unknown }).accountingMode);
  } catch {
    return 'international';
  }
}

export async function storeHasPostedJournalEntries(storeId: string): Promise<boolean> {
  const snap = await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('status', '==', 'posted')
    .limit(1)
    .get();
  return !snap.empty;
}

export async function assertAccountingModeChangeAllowed(
  storeId: string,
  nextMode: 'international' | 'lebanese',
): Promise<void> {
  const current = await resolveStoreAccountingMode(storeId);
  if (current === nextMode) return;
  const hasPosted = await storeHasPostedJournalEntries(storeId);
  if (hasPosted) {
    throw new Error(
      'Accounting mode cannot be changed after the first posted journal entry. Contact support for migration.',
    );
  }
}

export async function loadCoaMeta(storeId: string): Promise<{ coaMode?: string; initialized?: boolean }> {
  const snap = await getDb().collection('stores').doc(storeId).collection('ledgerMeta').doc('coa').get();
  return snap.exists ? (snap.data() as { coaMode?: string; initialized?: boolean }) : {};
}

export function seedRowsForMode(mode: 'international' | 'lebanese') {
  return buildDefaultLedgerAccounts('seed', mode);
}

/** Stamp profile lock after the first non-idempotent posted journal entry. */
export async function lockAccountingModeOnFirstPost(storeId: string): Promise<void> {
  const profileRef = getDb().collection('storeProfiles').doc(storeId);
  const snap = await profileRef.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  if (data.accountingModeLocked === true) return;
  await profileRef.set(
    {
      accountingModeLocked: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export { coaModeVersion };
