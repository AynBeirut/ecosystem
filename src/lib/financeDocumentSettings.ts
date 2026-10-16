import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mapFinanceInvoiceTemplateToGrabio } from '@/lib/invoiceTemplateMap';
import type { StoreProfile } from '@/types/storeProfile';
import { assertNipcoInvoiceTemplateWritable } from '@/lib/nipcoInvoiceTemplateLock';
import {
  readFinanceDocumentSettings,
  resolveA4DocumentBranding,
  type FinanceDocumentSettings,
} from '@/lib/financeDocumentSettingsCore';

export type { FinanceDocumentSettings };
export { readFinanceDocumentSettings, resolveA4DocumentBranding };

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export async function updateFinanceDocumentSettings(
  storeId: string,
  patch: Partial<FinanceDocumentSettings>,
): Promise<void> {
  assertNipcoInvoiceTemplateWritable(storeId);
  const ref = doc(db, 'storeProfiles', storeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const current = readFinanceDocumentSettings(snap.data() as StoreProfile);
  const merged = stripUndefined({ ...current, ...patch });
  const grabioTemplate =
    patch.invoiceTemplate !== undefined
      ? mapFinanceInvoiceTemplateToGrabio(patch.invoiceTemplate)
      : undefined;

  await updateDoc(
    ref,
    stripUndefined({
      financeDocumentSettings: merged,
      ...(grabioTemplate ? { invoiceTemplate: grabioTemplate } : {}),
      updatedAt: serverTimestamp(),
    }),
  );

  window.dispatchEvent(
    new CustomEvent('grabio:store-profile-updated', { detail: { storeId } }),
  );
}
