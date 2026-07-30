import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFinanceDb } from '@/integrations/firebase/client';
import { normalizeAccountingMode } from '@/lib/ledger/coaTemplates';

export async function resolveStoreAccountingMode(storeId: string): Promise<'international' | 'lebanese'> {
  try {
    const snap = await getDoc(doc(getFinanceDb(), 'storeProfiles', storeId));
    const data = snap.exists() ? snap.data() || {} : {};
    return normalizeAccountingMode((data as { accountingMode?: unknown }).accountingMode);
  } catch {
    return 'international';
  }
}

export async function lockAccountingModeOnFirstPost(storeId: string): Promise<void> {
  const profileRef = doc(getFinanceDb(), 'storeProfiles', storeId);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) return;
  const data = snap.data() || {};
  if (data.accountingModeLocked === true) return;
  await setDoc(
    profileRef,
    {
      accountingModeLocked: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export type AccountingLanguage = 'en' | 'ar' | 'bilingual';

export function normalizeAccountingLanguage(value: unknown, mode?: 'international' | 'lebanese'): AccountingLanguage {
  const raw = String(value || '').toLowerCase();
  if (raw === 'ar' || raw === 'arabic') return 'ar';
  if (raw === 'bilingual' || raw === 'bi') return 'bilingual';
  if (raw === 'en' || raw === 'english') return 'en';
  if (mode === 'lebanese') return 'bilingual';
  return 'en';
}

export function supportsArabicEntry(language: AccountingLanguage | undefined): boolean {
  return language === 'ar' || language === 'bilingual';
}

export function formatLedgerAccountLabel(
  account: { code: string; name: string; nameAr?: string },
  language: AccountingLanguage | undefined,
): string {
  if (supportsArabicEntry(language) && account.nameAr) {
    return `${account.code} — ${account.name} / ${account.nameAr}`;
  }
  return `${account.code} — ${account.name}`;
}
