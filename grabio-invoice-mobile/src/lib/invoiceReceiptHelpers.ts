import type { FinanceInvoice } from '../types';
import { isInvoiceUnpaid } from './financeDueDates';
import { listInvoices } from './financeService';

export function invoiceBalanceDue(invoice: Pick<FinanceInvoice, 'amount' | 'total' | 'paidAmount'>): number {
  const total = Number(invoice.total ?? invoice.amount) || 0;
  const paid = Number(invoice.paidAmount) || 0;
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export function invoiceDisplayLabel(invoice: FinanceInvoice): string {
  const ref = invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase();
  const due = invoiceBalanceDue(invoice);
  return `${ref} · ${invoice.clientName} · USD ${due.toFixed(2)} due`;
}

export async function searchOpenInvoices(
  storeId: string,
  query: string,
  limit = 25,
): Promise<FinanceInvoice[]> {
  const term = query.trim().toLowerCase();
  const invoices = await listInvoices(storeId);
  return invoices
    .filter((inv) => isInvoiceUnpaid(inv.status, inv.paidAmount, inv.total ?? inv.amount))
    .filter((inv) => invoiceBalanceDue(inv) > 0)
    .filter((inv) => {
      if (!term) return true;
      return (
        inv.clientName.toLowerCase().includes(term)
        || String(inv.invoiceNumber || '').toLowerCase().includes(term)
        || inv.id.toLowerCase().includes(term)
      );
    })
    .slice(0, limit);
}
