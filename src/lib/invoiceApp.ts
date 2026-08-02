/** Invoice Manager standalone SPA (TWA / Play Store). */
export const INVOICE_MANAGER_STANDALONE_URL = '/invoice/invoices';

/** Business Finance home in Grabio admin (same session, AdminLayout). */
export const BUSINESS_FINANCE_EMBED_URL = '/admin/finance/quotations';

/** @deprecated Use BUSINESS_FINANCE_EMBED_URL */
export const INVOICE_MANAGER_EMBED_URL = BUSINESS_FINANCE_EMBED_URL;

/** @deprecated Use INVOICE_MANAGER_EMBED_URL in admin nav */
export const INVOICE_MANAGER_URL = INVOICE_MANAGER_EMBED_URL;

export function openInvoiceManager(): void {
  window.location.assign(INVOICE_MANAGER_EMBED_URL);
}

/** Full-page navigation to a path inside the standalone invoice SPA. */
export function openInvoiceStandalonePath(subpath: string): void {
  const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`;
  window.location.assign(`/invoice${normalized}`);
}
