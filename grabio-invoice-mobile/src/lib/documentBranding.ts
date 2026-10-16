import firestore from '@react-native-firebase/firestore';
import { SHARED_COLLECTIONS } from './dataModel';
import {
  mapFinanceInvoiceTemplateToGrabio,
  mapGrabioInvoiceTemplateToFinance,
  type FinanceInvoiceTemplate,
} from './invoiceTemplateMap';
import {
  normalizeDocumentLayout,
  normalizeDocumentLineWeight,
  type DocumentLayoutStyle,
  type DocumentLineWeight,
} from './templateStyles';
import { assertNipcoInvoiceTemplateWritable } from './nipcoInvoiceTemplateLock';

/** A4/PDF branding — NIPCO production store must never be written from template setup flows. */

export type FinanceDocumentSettings = {
  documentLogo?: string;
  documentCompanyName?: string;
  /** When false, hide business name in PDF header (logo-only branding). Default true. */
  documentShowCompanyName?: boolean;
  documentAddress?: string;
  documentTaxId?: string;
  documentPhone?: string;
  documentEmail?: string;
  documentWebsite?: string;
  documentCountry?: string;
  /** A4 body/page tint on PDFs — hex color; empty = template default. */
  documentPageBackground?: string;
  documentFooterNote?: string;
  invoiceTemplate?: FinanceInvoiceTemplate;
  primaryColor?: string;
  secondaryColor?: string;
  signature?: string;
  /** Default payment terms — days after invoice date. */
  invoiceDueDays?: number;
  documentLayout?: DocumentLayoutStyle;
  documentLineWeight?: DocumentLineWeight;
};

export type DocumentCompany = {
  name: string;
  showCompanyName: boolean;
  address: string;
  phone: string;
  email: string;
  website?: string;
  country?: string;
  pageBackgroundColor?: string;
  logo: string;
  taxId?: string;
  primaryColor: string;
  secondaryColor: string;
  invoiceTemplate: FinanceInvoiceTemplate;
  signature?: string;
  footerNote?: string;
  documentLayout: DocumentLayoutStyle;
  documentLineWeight: DocumentLineWeight;
};

/** Same detection as web pdfExport — do not change without matching vendor/beirut-finance-flow. */
export function isNipcoCompany(company: Pick<DocumentCompany, 'name' | 'taxId'>): boolean {
  const name = (company.name || '').trim().toLowerCase();
  const taxId = (company.taxId || '').replace(/\s/g, '');
  return name.includes('nipco') || taxId.startsWith('4055989');
}

export function storeProfileToCompany(profile: Record<string, unknown> | null): DocumentCompany {
  const docSettings = (profile?.financeDocumentSettings ?? {}) as FinanceDocumentSettings;
  const templateColors = (profile?.templateColors ?? {}) as { primary?: string; secondary?: string; highlight?: string };
  const contactInfo = (profile?.contactInfo ?? {}) as { phone?: string; email?: string };

  return {
    name:
      docSettings.documentCompanyName?.trim() ||
      String(profile?.name || profile?.storeName || 'My Company'),
    showCompanyName: docSettings.documentShowCompanyName !== false,
    address: docSettings.documentAddress?.trim() || String(profile?.location || ''),
    phone: docSettings.documentPhone?.trim() || String(profile?.phone || contactInfo.phone || ''),
    email: docSettings.documentEmail?.trim() || String(profile?.email || contactInfo.email || ''),
    website:
      docSettings.documentWebsite !== undefined
        ? docSettings.documentWebsite.trim() || undefined
        : profile?.website
          ? String(profile.website)
          : undefined,
    country:
      docSettings.documentCountry !== undefined
        ? docSettings.documentCountry.trim() || undefined
        : 'Lebanon',
    pageBackgroundColor: docSettings.documentPageBackground?.trim() || undefined,
    logo: docSettings.documentLogo || String(profile?.logo || ''),
    taxId: docSettings.documentTaxId?.trim() || String(profile?.taxId || profile?.taxNumber || ''),
    primaryColor: docSettings.primaryColor || templateColors.primary || '#38B2AC',
    secondaryColor: docSettings.secondaryColor || templateColors.highlight || templateColors.secondary || '#2C5282',
    invoiceTemplate: mapGrabioInvoiceTemplateToFinance(
      profile?.invoiceTemplate ? String(profile.invoiceTemplate) : null,
      docSettings.invoiceTemplate,
    ),
    signature: docSettings.signature,
    footerNote: docSettings.documentFooterNote?.trim() || undefined,
    documentLayout: normalizeDocumentLayout(docSettings.documentLayout),
    documentLineWeight: normalizeDocumentLineWeight(docSettings.documentLineWeight),
  };
}

export async function loadDocumentCompany(storeId: string): Promise<DocumentCompany> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.storeProfiles).doc(storeId).get();
  return storeProfileToCompany(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
}

export async function updateFinanceDocumentSettings(
  storeId: string,
  patch: Partial<FinanceDocumentSettings>,
): Promise<void> {
  assertNipcoInvoiceTemplateWritable(storeId);
  const ref = firestore().collection(SHARED_COLLECTIONS.storeProfiles).doc(storeId);
  const snap = await ref.get();
  const current = snap.exists()
    ? (((snap.data() as Record<string, unknown>)?.financeDocumentSettings ?? {}) as FinanceDocumentSettings)
    : {};

  const merged: FinanceDocumentSettings = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  const payload: Record<string, unknown> = {
    financeDocumentSettings: merged,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };
  if (patch.invoiceTemplate !== undefined) {
    payload.invoiceTemplate = mapFinanceInvoiceTemplateToGrabio(patch.invoiceTemplate);
  }

  await ref.set(payload, { merge: true });
}

export async function loadFinanceDocumentSettings(storeId: string): Promise<{
  profile: Record<string, unknown> | null;
  doc: FinanceDocumentSettings;
  company: DocumentCompany;
}> {
  const snap = await firestore().collection(SHARED_COLLECTIONS.storeProfiles).doc(storeId).get();
  const profile = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  const doc = (profile?.financeDocumentSettings ?? {}) as FinanceDocumentSettings;
  const company = storeProfileToCompany(profile);
  return { profile, doc, company };
}
