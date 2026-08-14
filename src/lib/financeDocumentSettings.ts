import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  mapFinanceInvoiceTemplateToGrabio,
  mapGrabioInvoiceTemplateToFinance,
  type FinanceInvoiceTemplate,
  type GrabioInvoiceTemplate,
} from '@/lib/invoiceTemplateMap';
import type { StoreProfile } from '@/types/storeProfile';

export type FinanceDocumentSettings = {
  documentLogo?: string;
  documentCompanyName?: string;
  documentAddress?: string;
  documentTaxId?: string;
  invoiceTemplate?: FinanceInvoiceTemplate;
  primaryColor?: string;
  secondaryColor?: string;
  signature?: string;
};

export function readFinanceDocumentSettings(
  profile: StoreProfile | null | undefined,
): FinanceDocumentSettings {
  return (profile?.financeDocumentSettings ?? {}) as FinanceDocumentSettings;
}

/** Branding used on A4 invoices, estimates, and PDF exports (not POS 80mm receipts). */
export function resolveA4DocumentBranding(profile: StoreProfile | null | undefined) {
  const docSettings = readFinanceDocumentSettings(profile);
  const invoiceTemplate = mapGrabioInvoiceTemplateToFinance(
    profile?.invoiceTemplate,
    docSettings.invoiceTemplate,
  );
  const grabioTemplate = mapFinanceInvoiceTemplateToGrabio(invoiceTemplate);

  return {
    template: grabioTemplate as GrabioInvoiceTemplate,
    logo: docSettings.documentLogo || profile?.logo || '',
    companyName: docSettings.documentCompanyName?.trim() || profile?.name || 'Your Store',
    address: docSettings.documentAddress?.trim() || profile?.location || '',
    taxNumber: docSettings.documentTaxId?.trim() || profile?.taxNumber || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    website: profile?.website || '',
    slogan: profile?.slogan || '',
  };
}

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
