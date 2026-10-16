type DocSettings = {
  documentLogo?: string;
  documentCompanyName?: string;
  documentAddress?: string;
  documentPhone?: string;
  documentEmail?: string;
  documentWebsite?: string;
  documentCountry?: string;
  documentTaxId?: string;
  documentLayout?: string;
  invoiceTemplate?: string;
  documentShowLogo?: boolean;
  documentShowCompanyName?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  documentLineWeight?: string;
  documentFooterNote?: string;
  invoiceDueDays?: number;
  signature?: string;
};

export function resolveA4DocumentBranding(profile: Record<string, unknown> | null | undefined) {
  const docSettings = (profile?.financeDocumentSettings ?? {}) as DocSettings;
  const hasDocumentCompany = Boolean(docSettings.documentCompanyName?.trim());
  return {
    logo:
      docSettings.documentShowLogo === false
        ? ''
        : docSettings.documentLogo || String(profile?.logo || ''),
    companyName: hasDocumentCompany
      ? String(docSettings.documentCompanyName).trim()
      : String(profile?.name || profile?.storeName || 'Your Store'),
    address: docSettings.documentAddress?.trim() || String(profile?.location || ''),
    phone: docSettings.documentPhone?.trim() || String(profile?.phone || ''),
    email: docSettings.documentEmail?.trim() || String(profile?.email || ''),
    website: docSettings.documentWebsite?.trim() || String(profile?.website || ''),
    country: docSettings.documentCountry?.trim() || '',
    taxNumber: docSettings.documentTaxId?.trim() || String(profile?.taxNumber || ''),
    showCompanyName: docSettings.documentShowCompanyName !== false,
    layout: docSettings.documentLayout || 'minimal',
    signature: String(docSettings.signature || ''),
    primaryColor: docSettings.primaryColor || '#3182CE',
    secondaryColor: docSettings.secondaryColor || '#2B6CB0',
    footer: docSettings.documentFooterNote?.trim() || '',
    invoiceDueDays:
      typeof docSettings.invoiceDueDays === 'number' && docSettings.invoiceDueDays > 0
        ? docSettings.invoiceDueDays
        : 30,
  };
}
