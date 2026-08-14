import type { Invoice, PurchaseOrder, PaymentOrder } from '@/context/AppContext';
import type { Expense, PaymentMethod } from '@/types/accounting';
import { ensureDefaultChartOfAccounts } from '@/lib/firestore/ledgerFirestore';
import {
  autoPostExpensePaid,
  autoPostInvoicePayment,
  autoPostInvoiceSaleRecognized,
  autoPostInvoiceUnpaidReversal,
  autoPostPurchasePaid,
  autoPostPurchaseReceived,
  autoPostOrderSaleRecognized,
  autoPostOrderSaleReversal,
  autoPostProductionComplete,
  autoPostProductionReversal,
  autoPostProductionStart,
  autoPostProductionWipCompleteFlow,
  type ProductionReversalInput,
  autoPostPayrollPayment,
  autoPostCashCollectionDeposit,
  autoPostDeliveryWalletCodCollected,
  autoPostDeliveryWalletSettlement,
  isCreditTermsSale,
  isImmediateCashSale,
  type InvoicePaymentInput,
  type PlatformOrderInput,
} from '@/lib/ledger/autoPosting';
import { paymentSourceKey, upsertAutoPaymentReceiptDoc } from '@/lib/ledger/paymentReceiptDoc';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function logGlError(scope: string, err: unknown): never {
  console.error(`[GL][${scope}]`, err);
  const message = err instanceof Error ? err.message : String(err);
  throw new Error(`GL posting failed (${scope}): ${message}`);
}

function invoiceTotal(invoice: Invoice): number {
  return round2(Number(invoice.total ?? invoice.amount) || 0);
}

const SALE_RECOGNITION_STATUSES = new Set(['sent', 'partial', 'paid', 'pending_manual_payment']);

export async function glPostInvoiceSaleRecognized(storeId: string, invoice: Invoice): Promise<void> {
  if (!SALE_RECOGNITION_STATUSES.has(invoice.status)) return;
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostInvoiceSaleRecognized(storeId, invoice, accounts);
  } catch (err) {
    logGlError('invoice-sale', err);
  }
}

export async function glPostInvoicePayment(
  storeId: string,
  invoice: Invoice,
  payment: InvoicePaymentInput,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    const posted = await autoPostInvoicePayment(storeId, invoice, payment, accounts);
    if (!posted) return;
    const event = `payment-${payment.id}`;
    const sourceKey = paymentSourceKey('invoice_payment', invoice.id, event);
    await upsertAutoPaymentReceiptDoc({
      storeId,
      sourceType: 'invoice_payment',
      sourceId: payment.id,
      sourceKey,
      direction: 'in',
      amount: payment.amount,
      date: payment.paymentDate.slice(0, 10),
      method: payment.paymentMethod || 'cash',
      partyName: invoice.clientName || `Invoice ${invoice.id}`,
      currency: invoice.currency,
      journalEntryId: posted.entryId,
      voucherNumber: posted.voucherNumber,
    });
  } catch (err) {
    logGlError('invoice-payment', err);
  }
}

export async function glPostInvoiceUnpaidReversal(storeId: string, prevInvoice: Invoice): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    const reversalId = `${prevInvoice.id}-${Date.now()}`;
    await autoPostInvoiceUnpaidReversal(storeId, prevInvoice, accounts, reversalId);
  } catch (err) {
    logGlError('invoice-unpaid-reversal', err);
  }
}

/** Orchestrates sale recognition + payment receipt based on invoice state transitions. */
export async function glSyncInvoiceGl(storeId: string, invoice: Invoice, prev?: Invoice): Promise<void> {
  const statusChanged = !prev || prev.status !== invoice.status;
  const prevCollected = round2(
    (prev?.paidAmount || 0) > 0
      ? prev!.paidAmount!
      : prev?.status === 'paid'
        ? invoiceTotal(prev)
        : 0,
  );
  const nextCollected = round2(invoice.paidAmount || 0);

  const becameUnpaid =
    prev &&
    (prev.status === 'paid' || prev.status === 'partial') &&
    invoice.status !== 'paid' &&
    invoice.status !== 'partial' &&
    (statusChanged || nextCollected < prevCollected);

  if (becameUnpaid) {
    await glPostInvoiceUnpaidReversal(storeId, prev);
    return;
  }

  const becameRecognizable =
    statusChanged &&
    SALE_RECOGNITION_STATUSES.has(invoice.status) &&
    (!prev || !SALE_RECOGNITION_STATUSES.has(prev.status));

  if (becameRecognizable) {
    await glPostInvoiceSaleRecognized(storeId, invoice);
  }

  const prevPaid = round2(prev?.paidAmount || 0);
  const nextPaid = round2(invoice.paidAmount || 0);
  const paymentDelta = round2(nextPaid - prevPaid);

  if (paymentDelta > 0 && isCreditTermsSale(invoice)) {
    await glPostInvoicePayment(storeId, invoice, {
      id: `invpay-${Date.now()}`,
      amount: paymentDelta,
      paymentMethod: invoice.paymentMethod || 'cash',
      paymentDate: invoice.paidAt || new Date().toISOString(),
    });
  }

  // Direct mark-paid without explicit paidAmount (InvoiceList toggle, manual confirm)
  if (
    statusChanged &&
    invoice.status === 'paid' &&
    isCreditTermsSale(invoice) &&
    nextPaid === 0
  ) {
    const remaining = invoiceTotal(invoice);
    if (remaining > 0) {
      await glPostInvoicePayment(storeId, invoice, {
        id: `invpay-full-${invoice.id}`,
        amount: remaining,
        paymentMethod: invoice.paymentMethod || 'cash',
        paymentDate: invoice.paidAt || new Date().toISOString(),
      });
    }
  }

  // Cash-at-POS: draft → paid skips sent; recognize sale on first paid transition
  if (
    statusChanged &&
    invoice.status === 'paid' &&
    isImmediateCashSale(invoice) &&
    (!prev || prev.status !== 'paid')
  ) {
    await glPostInvoiceSaleRecognized(storeId, invoice);
  }
}

/** @deprecated Prefer glSyncInvoiceGl */
export async function glPostInvoicePaid(storeId: string, invoice: Invoice): Promise<void> {
  await glSyncInvoiceGl(storeId, invoice);
}

export async function glPostExpensePayment(
  storeId: string,
  expense: Expense,
  amount: number,
  paymentMethod: PaymentMethod,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostExpensePaid(storeId, expense, amount, paymentMethod, accounts);
  } catch (err) {
    logGlError('expense-paid', err);
  }
}

export async function glPostPurchaseReceived(storeId: string, po: PurchaseOrder): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostPurchaseReceived(storeId, po, accounts);
  } catch (err) {
    logGlError('purchase-received', err);
  }
}

export async function glPostPurchasePayment(storeId: string, payment: PaymentOrder): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    const stubPo: PurchaseOrder = {
      id: payment.purchaseOrderId || payment.id,
      date: payment.date,
      supplierId: payment.supplierId,
      supplierName: payment.supplierName,
      items: [],
      amount: payment.amount,
      currency: payment.currency,
      status: 'fulfilled',
    };
    const event = `paid-${payment.id}`;
    const posted = await autoPostPurchasePaid(
      storeId,
      stubPo,
      accounts,
      payment.paymentMethod || 'bank',
      undefined,
      event,
    );
    if (!posted) return;
    const sourceKey = paymentSourceKey('purchase_payment', stubPo.id, event);
    await upsertAutoPaymentReceiptDoc({
      storeId,
      sourceType: 'payment_order',
      sourceId: payment.id,
      sourceKey,
      direction: 'out',
      amount: payment.amount,
      date: payment.date.slice(0, 10),
      method: payment.paymentMethod || 'bank',
      partyName: payment.supplierName || 'Supplier',
      currency: payment.currency,
      notes: payment.notes,
      journalEntryId: posted.entryId,
      voucherNumber: posted.voucherNumber,
    });
  } catch (err) {
    logGlError('purchase-paid', err);
  }
}

/** Post GL for platform purchases already received (idempotent). */
export async function glSyncPurchasesOnLoad(storeId: string, purchaseOrders: PurchaseOrder[]): Promise<void> {
  const receivable = purchaseOrders.filter((po) => po.status === 'fulfilled');
  for (const po of receivable) {
    await glPostPurchaseReceived(storeId, po);
  }
}

export type { PlatformOrderInput };

export async function glPostOrderSaleRecognized(storeId: string, order: PlatformOrderInput): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostOrderSaleRecognized(storeId, order, accounts);
  } catch (err) {
    logGlError('order-sale', err);
  }
}

export async function glPostOrderSaleReversal(
  storeId: string,
  order: PlatformOrderInput,
  reversalId: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostOrderSaleReversal(storeId, order, accounts, reversalId);
  } catch (err) {
    logGlError('order-reversal', err);
  }
}

export async function glPostProductionStart(
  storeId: string,
  batchId: string,
  materialsCost: number,
  date: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionStart(storeId, batchId, materialsCost, date, accounts);
  } catch (err) {
    logGlError('production-start', err);
  }
}

export async function glPostProductionWipComplete(
  storeId: string,
  batchId: string,
  costStart: number,
  costActual: number,
  date: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionWipCompleteFlow(storeId, batchId, costStart, costActual, date, accounts);
  } catch (err) {
    logGlError('production-complete-wip', err);
  }
}

export async function glPostProductionComplete(
  storeId: string,
  batchId: string,
  materialsCost: number,
  date: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionComplete(storeId, batchId, materialsCost, date, accounts);
  } catch (err) {
    logGlError('production-complete', err);
  }
}

export async function glPostProductionReversal(
  storeId: string,
  batchId: string,
  reversalId: string,
  input: ProductionReversalInput,
  date: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostProductionReversal(storeId, batchId, reversalId, input, date, accounts);
  } catch (err) {
    logGlError('production-reversal', err);
  }
}

export async function glPostPayrollPayment(
  storeId: string,
  paymentId: string,
  totalAmount: number,
  paymentDate: string,
  paymentMethod = 'bank',
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostPayrollPayment(storeId, paymentId, totalAmount, paymentDate, paymentMethod, accounts);
  } catch (err) {
    logGlError('payroll', err);
  }
}

export async function glPostCashCollectionDeposit(
  storeId: string,
  collectionId: string,
  totalAmount: number,
  collectionDate: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostCashCollectionDeposit(storeId, collectionId, totalAmount, collectionDate, accounts);
  } catch (err) {
    logGlError('cash-collection', err);
  }
}

export async function glPostDeliveryWalletCodCollected(
  storeId: string,
  orderId: string,
  amount: number,
  collectionDate: string,
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostDeliveryWalletCodCollected(storeId, orderId, amount, collectionDate, accounts);
  } catch (err) {
    logGlError('delivery-wallet-cod', err);
  }
}

export async function glPostDeliveryWalletSettlement(
  storeId: string,
  settlementId: string,
  amount: number,
  settlementDate: string,
  destination: 'cash' | 'bank' = 'cash',
): Promise<void> {
  try {
    const accounts = await ensureDefaultChartOfAccounts(storeId);
    await autoPostDeliveryWalletSettlement(storeId, settlementId, amount, settlementDate, accounts, undefined, destination);
  } catch (err) {
    logGlError('delivery-wallet-settle', err);
  }
}
