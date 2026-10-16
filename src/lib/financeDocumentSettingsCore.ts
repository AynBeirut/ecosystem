import {
  mapFinanceInvoiceTemplateToGrabio,
  mapGrabioInvoiceTemplateToFinance,
  type FinanceInvoiceTemplate,
  type GrabioInvoiceTemplate,
} from './invoiceTemplateMap';
import type { StoreProfile } from '../types/storeProfile';

export type FinanceDocumentSettings = {
  deliveryExpenseLedgerAccountId?: string;
  deliveryExpenseLedgerAccountCode?: string;
  deliveryExpenseLedgerAccountName?: string;
  documentLogo?: string;
  documentCompanyName?: string;
  documentAddress?: string;
  documentPhone?: string;
  documentEmail?: string;
  documentWebsite?: string;
  documentCountry?: string;
  documentTaxId?: string;
  documentShowCompanyName?: boolean;
  /** Address and website: header block or page footer, never both. */
  documentContactPlacement?: 'hero' | 'footer';
  documentLayout?: 'minimal' | 'classic' | 'modern' | string;
  invoiceTemplate?: FinanceInvoiceTemplate;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  signature?: string;
  documentSignatoryName?: string;
  documentFooter?: string;
  documentFooterNote?: string;
  documentLineWeight?: 'fine' | 'regular' | 'bold' | string;
  documentLineStyle?: 'solid' | 'double' | 'dashed' | 'none' | string;
  documentBankDetails?: string;
  documentTemplateNumber?: number;
  documentColorMode?: 'colored' | 'bw';
  documentFontScale?: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | string;
  documentBorderColor?: string;
  documentHeaderSpace?: number;
  documentOrgAlign?: 'left' | 'center' | 'right';
  documentLogoAlign?: 'left' | 'center' | 'right';
  invoiceDueDays?: number;
  documentShowTax?: boolean;
  documentShowLogo?: boolean;
};

export function readFinanceDocumentSettings(
  profile: StoreProfile | null | undefined,
): FinanceDocumentSettings {
  return (profile?.financeDocumentSettings ?? {}) as FinanceDocumentSettings;
}

/** Branding used on A4 invoices, estimates, and PDF exports (not POS 80mm receipts). */
export function resolveA4DocumentBranding(profile: StoreProfile | null | undefined) {
  const docSettings = readFinanceDocumentSettings(profile);
  const financeTemplate = mapGrabioInvoiceTemplateToFinance(
    profile?.invoiceTemplate,
    docSettings.invoiceTemplate,
  );
  const grabioTemplate = mapFinanceInvoiceTemplateToGrabio(financeTemplate);
  const hasDocumentCompany = Boolean(docSettings.documentCompanyName?.trim());

  return {
    template: grabioTemplate as GrabioInvoiceTemplate,
    financeTemplate,
    logo:
      docSettings.documentShowLogo === false
        ? ''
        : docSettings.documentLogo || profile?.logo || '',
    companyName: hasDocumentCompany
      ? docSettings.documentCompanyName!.trim()
      : profile?.name || 'Your Store',
    address: docSettings.documentAddress?.trim() || profile?.location || '',
    taxNumber: docSettings.documentTaxId?.trim() || profile?.taxNumber || '',
    phone: docSettings.documentPhone?.trim() || profile?.phone || '',
    email: docSettings.documentEmail?.trim() || profile?.email || '',
    website: docSettings.documentWebsite?.trim() || profile?.website || '',
    country: docSettings.documentCountry?.trim() || '',
    contactPlacement: docSettings.documentContactPlacement === 'footer' ? 'footer' : 'hero',
    showCompanyName: docSettings.documentShowCompanyName !== false,
    layout: docSettings.documentLayout || '',
    primaryColor: docSettings.primaryColor || '',
    secondaryColor: docSettings.secondaryColor || '',
    textColor: docSettings.textColor || '',
    signature: docSettings.signature || '',
    signatoryName: docSettings.documentSignatoryName?.trim() || '',
    footer:
      docSettings.documentFooter?.trim() ||
      docSettings.documentFooterNote?.trim() ||
      '',
    lineWeight: docSettings.documentLineWeight || 'regular',
    lineStyle: docSettings.documentLineStyle || 'solid',
    bankDetails: docSettings.documentBankDetails?.trim() || '',
    templateNumber:
      docSettings.documentTemplateNumber && docSettings.documentTemplateNumber >= 1 && docSettings.documentTemplateNumber <= 10
        ? docSettings.documentTemplateNumber
        : 2,
    colorMode: docSettings.documentColorMode === 'bw' ? 'bw' : 'colored',
    fontScale: docSettings.documentFontScale || 'm',
    borderColor: docSettings.documentBorderColor || '',
    headerSpace:
      typeof docSettings.documentHeaderSpace === 'number' ? docSettings.documentHeaderSpace : 16,
    orgAlign: docSettings.documentOrgAlign || 'left',
    logoAlign: docSettings.documentLogoAlign || 'left',
    invoiceDueDays:
      typeof docSettings.invoiceDueDays === 'number' && docSettings.invoiceDueDays > 0
        ? docSettings.invoiceDueDays
        : 30,
    showTax: docSettings.documentShowTax !== false,
    slogan: profile?.slogan || '',
  };
}
