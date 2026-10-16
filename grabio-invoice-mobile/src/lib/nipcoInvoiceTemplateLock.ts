/** NIPCO production store — invoice/PDF template is ecosystem-locked (Anwar override only). */
export const NIPCO_PRODUCTION_STORE_ID = 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';

/** Team rule: never include NIPCO in template setup or bulk script migrations. */

export const NIPCO_TEMPLATE_LOCK_MESSAGE =
  'Nipco invoice template is locked for production consistency. Contact Grabio ecosystem owner (Anwar) to change it.';

export function isNipcoProductionStore(storeId: string | null | undefined): boolean {
  return Boolean(storeId && storeId === NIPCO_PRODUCTION_STORE_ID);
}

export function assertNipcoInvoiceTemplateWritable(storeId: string): void {
  if (isNipcoProductionStore(storeId)) {
    throw new Error(NIPCO_TEMPLATE_LOCK_MESSAGE);
  }
}
