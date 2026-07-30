import type { SettlementAllocationInput } from '@/types/generalLedger';
import type { Invoice, PurchaseOrder } from '@/types/index';
import type { VoucherLineSettlement } from '@/types/generalLedger';
import { invoiceOutstandingBalance } from '@/lib/ledger/agedReceivables';
import { purchaseOrderPaidTotal } from '@/lib/ledger/agedPayables';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type OpenItemRow = {
  documentId: string;
  documentType: 'invoice' | 'purchase_order';
  documentNumber: string;
  date: string;
  partyId: string;
  partyName: string;
  total: number;
  settled: number;
  remaining: number;
  currency?: string;
};

function settledForDocument(documentId: string, settlements: VoucherLineSettlement[]): number {
  return round2(
    settlements.filter((s) => s.documentId === documentId).reduce((sum, s) => sum + (s.allocatedAmountBase || 0), 0),
  );
}

export function buildOpenInvoices(
  invoices: Invoice[],
  settlements: VoucherLineSettlement[],
  clientId?: string,
): OpenItemRow[] {
  return invoices
    .filter((inv) => !clientId || inv.clientId === clientId)
    .filter((inv) => inv.status !== 'draft' && inv.status !== 'paid')
    .map((inv) => {
      const glRemaining = invoiceOutstandingBalance({
        id: inv.id,
        date: inv.createdAt,
        clientId: inv.clientId,
        clientName: inv.clientName,
        status: inv.status,
        amount: inv.total,
        total: inv.total,
        paidAmount: inv.paidAmount,
        currency: inv.currency,
      });
      const settled = settledForDocument(inv.id, settlements);
      const remaining = round2(Math.max(0, glRemaining - settled));
      return {
        documentId: inv.id,
        documentType: 'invoice' as const,
        documentNumber: inv.invoiceNumber,
        date: inv.createdAt.slice(0, 10),
        partyId: inv.clientId,
        partyName: inv.clientName,
        total: inv.total,
        settled,
        remaining,
        currency: inv.currency,
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildOpenPurchaseOrders(
  purchaseOrders: PurchaseOrder[],
  paymentOrders: Array<{ purchaseOrderId?: string; amount?: number }>,
  settlements: VoucherLineSettlement[],
  supplierId?: string,
): OpenItemRow[] {
  return purchaseOrders
    .filter((po) => !supplierId || po.supplierId === supplierId)
    .filter((po) => po.status !== 'draft' && po.status !== 'cancelled')
    .map((po) => {
      const paid = purchaseOrderPaidTotal(po.id, paymentOrders, (po as PurchaseOrder & { paidAmount?: number }).paidAmount);
      const total = round2(po.total || 0);
      const baseRemaining = round2(Math.max(0, total - paid));
      const settled = settledForDocument(po.id, settlements);
      const remaining = round2(Math.max(0, baseRemaining - settled));
      return {
        documentId: po.id,
        documentType: 'purchase_order' as const,
        documentNumber: po.poNumber,
        date: po.createdAt.slice(0, 10),
        partyId: po.supplierId,
        partyName: po.supplierName,
        total,
        settled,
        remaining,
        currency: po.currency,
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function validateAllocations(
  paymentAmount: number,
  allocations: SettlementAllocationInput[],
  openItems: OpenItemRow[],
): { valid: boolean; message?: string } {
  const total = round2(allocations.reduce((s, a) => s + a.allocatedAmountBase, 0));
  if (total <= 0) return { valid: true };
  if (total > round2(paymentAmount)) {
    return { valid: false, message: `Allocations (${total}) exceed payment amount (${paymentAmount}).` };
  }
  for (const alloc of allocations) {
    const item = openItems.find((o) => o.documentId === alloc.documentId);
    if (!item) return { valid: false, message: `Document ${alloc.documentId} not found or already closed.` };
    if (alloc.allocatedAmountBase > item.remaining) {
      return { valid: false, message: `Allocation exceeds remaining on ${item.documentNumber}.` };
    }
  }
  return { valid: true };
}
