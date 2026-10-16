import { normalizeInvoiceStatus } from './invoiceStatus';

export const DEFAULT_INVOICE_DUE_DAYS = 30;

export function resolveInvoiceDueDays(settings?: { invoiceDueDays?: number } | null): number {
  const n = Number(settings?.invoiceDueDays);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_INVOICE_DUE_DAYS;
}

export function computeInvoiceDueDate(invoiceDateIso: string, dueDays: number): string {
  const d = new Date(invoiceDateIso);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + dueDays);
    fallback.setHours(23, 59, 59, 999);
    return fallback.toISOString();
  }
  d.setDate(d.getDate() + dueDays);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isInvoiceUnpaid(
  status: string,
  paidAmount?: number,
  total?: number,
): boolean {
  const normalized = normalizeInvoiceStatus(status);
  if (normalized === 'paid') return false;
  if (paidAmount != null && total != null && paidAmount >= total) return false;
  return true;
}
