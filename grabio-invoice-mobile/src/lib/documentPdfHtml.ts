import { generateProfessionalDocumentHTML } from '../../../src/lib/electroServiceDocumentHtml';

type Line = { description: string; quantity: number; unitPrice: number; subtotal: number };

type PrintableDoc = {
  invoiceNumber?: string;
  estimateNumber?: string;
  clientName?: string;
  date?: string;
  items?: Line[];
  tax?: number;
  discount?: number;
  total?: number;
  amount?: number;
  currency?: string;
  notes?: string;
  status?: string;
};

function docNumber(kind: 'invoice' | 'estimate', doc: PrintableDoc) {
  const n =
    kind === 'estimate'
      ? doc.estimateNumber || doc.invoiceNumber
      : doc.invoiceNumber || doc.estimateNumber;
  const ref = String(n || '').trim();
  if (ref && !/^[A-Za-z0-9_-]{20,}$/.test(ref)) return ref;
  return kind === 'estimate' ? 'EST-PENDING' : 'INV-PENDING';
}

export function buildFinanceDocumentHtml(
  kind: 'invoice' | 'estimate',
  doc: PrintableDoc,
  profile: Record<string, unknown> | null,
): string {
  const currency = doc.currency || 'USD';
  const money = (amount: number) => `${currency} ${Number(amount || 0).toFixed(2)}`;
  const items = (doc.items || []).map((item, index) => ({
    productId: `line-${index}`,
    productName: item.description || 'Item',
    description: '',
    quantity: item.quantity,
    price: item.unitPrice,
  }));
  return generateProfessionalDocumentHTML({
    kind,
    order: {
      id: 'document',
      createdAt: doc.date || new Date().toISOString(),
      customerName: doc.clientName || 'Client',
      total: doc.total ?? doc.amount,
      items,
    },
    products: [],
    storeProfile: profile as never,
    formatCurrency: (amount) => money(amount),
    documentRef: docNumber(kind, doc),
  });
}

export function financePdfFileName(kind: 'invoice' | 'estimate', doc: PrintableDoc): string {
  const num = docNumber(kind, doc).replace(/[^\w.-]+/g, '_');
  return `${kind === 'estimate' ? 'Estimate' : 'Invoice'}-${num}.pdf`;
}

export const TEMPLATE_PREVIEW_DOC: PrintableDoc = {
  invoiceNumber: 'INV-1001',
  clientName: 'Sample Client',
  date: new Date().toISOString(),
  currency: 'USD',
  items: [
    { description: 'Sample product', quantity: 2, unitPrice: 50, subtotal: 100 },
    { description: 'Sample service', quantity: 1, unitPrice: 25, subtotal: 25 },
  ],
  total: 125,
};
