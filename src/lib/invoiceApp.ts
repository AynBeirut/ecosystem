/** Invoice Manager standalone SPA (TWA / Play Store). */
export const INVOICE_MANAGER_STANDALONE_URL = '/invoice/invoices';

/** Invoice Manager embedded in Grabio admin (same session, AdminLayout). */
export const INVOICE_MANAGER_EMBED_URL = '/admin/finance/invoices';

/** @deprecated Use INVOICE_MANAGER_EMBED_URL in admin nav */
export const INVOICE_MANAGER_URL = INVOICE_MANAGER_EMBED_URL;

export function openInvoiceManager(): void {
  window.location.assign(INVOICE_MANAGER_EMBED_URL);
}
