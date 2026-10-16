import type { FinanceInvoice } from '../types';

export type InvoicePaymentFilter = 'all' | 'unpaid' | 'partial' | 'paid';

/** Web creates `draft`; mobile uses `sent` for outstanding invoices. */
export function normalizeInvoiceStatus(status: unknown): FinanceInvoice['status'] {
  const s = String(status || 'sent').toLowerCase();
  if (s === 'draft') return 'sent';
  if (s === 'paid' || s === 'partial' || s === 'sent' || s === 'pending_manual_payment') {
    return s as FinanceInvoice['status'];
  }
  return 'sent';
}

export function invoicePaymentLabel(
  status: FinanceInvoice['status'],
  paidAmount?: number,
  total?: number,
): string {
  const normalized = normalizeInvoiceStatus(status);
  if (normalized === 'paid' || (paidAmount != null && total != null && paidAmount >= total && total > 0)) {
    return 'Paid';
  }
  if (normalized === 'partial') return 'Partial';
  return 'Unpaid';
}

export function invoiceMatchesPaymentFilter(
  invoice: Pick<FinanceInvoice, 'status' | 'paidAmount' | 'amount' | 'total'>,
  filter: InvoicePaymentFilter,
): boolean {
  if (filter === 'all') return true;
  const label = invoicePaymentLabel(
    invoice.status,
    invoice.paidAmount,
    invoice.total ?? invoice.amount,
  ).toLowerCase();
  return label === filter;
}
