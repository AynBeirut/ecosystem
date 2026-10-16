import type { Order } from '../types/order';
import type { StoreProfile } from '../types/storeProfile';
import { generateProfessionalDocumentHTML } from './electroServiceDocumentHtml';

export type FinancePrintableKind = 'invoice' | 'estimate';

export type FinancePrintableDoc = {
  id?: string;
  invoiceNumber?: string;
  estimateNumber?: string;
  orderNumber?: string;
  date?: string;
  createdAt?: string;
  clientName?: string;
  customer?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxId?: string;
  clientAddress?: string;
  customerAddress?: string;
  items?: Array<{
    id?: string;
    productId?: string;
    productName?: string;
    name?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    price?: number;
    subtotal?: number;
    discountValue?: number;
    discountType?: string;
  }>;
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  discountAmount?: number;
  total?: number;
  amount?: number;
  currency?: string;
  notes?: string;
  invoiceNotes?: string;
  paymentStatus?: string;
  amountPaid?: number;
  status?: string;
};

function resolveFinanceDocumentNumber(kind: FinancePrintableKind, doc: FinancePrintableDoc): string {
  const candidates =
    kind === 'estimate'
      ? [doc.estimateNumber, doc.orderNumber, doc.invoiceNumber]
      : [doc.invoiceNumber, doc.orderNumber, doc.estimateNumber];
  for (const value of candidates) {
    const ref = String(value || '').trim();
    if (ref && ref.length < 40 && !/^[A-Za-z0-9_-]{20,}$/.test(ref)) return ref;
  }
  return kind === 'estimate' ? 'EST-PENDING' : 'INV-PENDING';
}

function financeDocToOrder(kind: FinancePrintableKind, doc: FinancePrintableDoc): Order & { id: string } {
  const items = (doc.items || []).map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice ?? item.price) || 0;
    const name = item.productName || item.name || item.description || 'Item';
    return {
      productId: item.productId || item.id || `line-${index}`,
      productName: name,
      description: item.description || item.name || '',
      quantity: qty,
      price,
      discountValue: item.discountValue,
      discountType: item.discountType as Order['items'][0]['discountType'],
    };
  });

  const subtotal =
    Number(doc.subtotal) ||
    items.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const taxRate = Number(doc.taxRate ?? doc.tax) || 0;
  const taxAmount = Number(doc.taxAmount) || subtotal * (taxRate / 100);
  const discountAmount = Number(doc.discountAmount ?? doc.discount) || 0;
  const total = Number(doc.total ?? doc.amount) || subtotal + taxAmount - discountAmount;

  return {
    id: doc.id || 'finance-doc',
    invoiceNumber: resolveFinanceDocumentNumber(kind, doc),
    orderNumber: resolveFinanceDocumentNumber(kind, doc),
    customerName: doc.clientName || doc.customer || 'N/A',
    customerPhone: doc.customerPhone,
    customerEmail: doc.customerEmail,
    customerTaxId: doc.customerTaxId,
    deliveryAddress: doc.clientAddress || doc.customerAddress,
    items,
    subtotal,
    taxRate,
    taxAmount,
    discountAmount,
    total,
    invoiceNotes: doc.invoiceNotes || doc.notes,
    paymentStatus:
      doc.paymentStatus ||
      (doc.status === 'paid' ? 'paid' : doc.status === 'partial' ? 'partial' : 'unpaid'),
    amountPaid: doc.amountPaid,
    createdAt: doc.date || doc.createdAt || new Date().toISOString(),
    status: 'delivered',
  } as Order & { id: string };
}

/** Shared professional A4 structure for invoices and estimates. */
export function generateFinanceDocumentHTML(
  kind: FinancePrintableKind,
  doc: FinancePrintableDoc,
  storeProfile: StoreProfile | null,
  formatCurrency: (amount: number, showDual?: boolean) => string,
): string {
  const order = financeDocToOrder(kind, doc);
  const products = (doc.items || []).map((item, index) => ({
    id: item.productId || item.id || `line-${index}`,
    name: item.productName || item.name || item.description || 'Item',
    description: item.description,
    price: Number(item.unitPrice ?? item.price) || 0,
  }));

  const docRef = resolveFinanceDocumentNumber(kind, doc);
  return generateProfessionalDocumentHTML({
    kind,
    order,
    products,
    storeProfile,
    formatCurrency,
    documentRef: docRef,
  });
}

export function financeDocumentPdfFileName(kind: FinancePrintableKind, doc: FinancePrintableDoc): string {
  const num = resolveFinanceDocumentNumber(kind, doc).replace(/[^\w.-]+/g, '_');
  const prefix = kind === 'estimate' ? 'Estimate' : 'Invoice';
  return `${prefix}-${num}.pdf`;
}
