/** NIPCO production store — invoice/PDF template is ecosystem-locked (Anwar override only). */
export const NIPCO_PRODUCTION_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

export const NIPCO_TAX_ID = '4055989-601';

/**
 * Team rule: template breaks on NIPCO came from internal migrations/refactors — never from users.
 * When building invoice template setup (web/mobile) or bulk scripts: skip NIPCO entirely.
 * Audit: node scripts/auditNipcoInvoiceTemplate.cjs
 */
export const NIPCO_CANONICAL_TEMPLATE = {
  documentCompanyName: 'Nipco',
  documentTaxId: NIPCO_TAX_ID,
  documentShowCompanyName: true,
  documentCountry: 'Lebanon',
  invoiceTemplate: 'modern' as const,
  primaryColor: '#2A4E8C',
  secondaryColor: '#93B5E1',
  documentLayout: 'classic' as const,
  documentLineWeight: 'regular' as const,
  invoiceDueDays: 30,
  nipcoTemplateLocked: true,
  taxNumber: NIPCO_TAX_ID,
};

export const NIPCO_TEMPLATE_LOCK_MESSAGE =
  'Nipco invoice template is locked for production consistency. Contact Grabio ecosystem owner (Anwar) to change it.';

export const NIPCO_PROTECTED_PROFILE_FIELDS = [
  'financeDocumentSettings',
  'invoiceTemplate',
  'template',
  'templateColors',
  'taxNumber',
  'logo',
  'slogan',
] as const;

export function isNipcoProductionStore(storeId: string | null | undefined): boolean {
  return Boolean(storeId && storeId === NIPCO_PRODUCTION_STORE_ID);
}

export function assertNipcoInvoiceTemplateWritable(
  storeId: string,
  options?: { ownerOverride?: boolean },
): void {
  if (options?.ownerOverride) return;
  if (isNipcoProductionStore(storeId)) {
    throw new Error(NIPCO_TEMPLATE_LOCK_MESSAGE);
  }
}
