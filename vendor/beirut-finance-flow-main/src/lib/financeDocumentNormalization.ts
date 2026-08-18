import type { Client, Invoice, LineItem } from '@/context/AppContext';
import type { ExportableType } from '@/lib/pdfExport';

type AnyRecord = Record<string, unknown>;

const toText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export function isMojibakeLine(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[þÞ]/.test(trimmed)) return true;

  const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
  if (hasArabic) return false;

  if (/[A-Za-z0-9]/.test(trimmed)) return false;

  const latin1Noise = trimmed.match(/[\u00C0-\u00FF]/g) || [];
  const commonMojibake = /(?:Ã|Â|Ø|Ù|Ð|Ñ).{2,}/.test(trimmed);
  return commonMojibake || latin1Noise.length >= 4;
}

function stripMojibakePrefix(value: string): string {
  return value
    .replace(/^[\s\u00C0-\u00FF=<>|/\\\\]+(?=[A-Za-z0-9$+("'-])/u, '')
    .replace(/(?:þ|Þ)[^\n\r]*/g, '')
    .trim();
}

export function normalizeHumanText(value: unknown): string {
  return toText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map(stripMojibakePrefix)
    .filter(Boolean)
    .filter((line) => !isMojibakeLine(line))
    .join('\n');
}

export function cleanLines(...values: unknown[]): string[] {
  return values
    .map((value) => normalizeHumanText(value))
    .flatMap((value) => value.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
}

export function firstCleanText(...values: unknown[]): string {
  for (const value of values) {
    const clean = normalizeHumanText(value);
    if (clean) return clean;
  }
  return '';
}

export function resolveInvoiceNumber(doc: AnyRecord): string {
  const direct = firstCleanText(
    doc.invoiceNumber,
    doc.orderNumber,
    doc.voucherNumber,
    doc.receiptNumber,
    doc.receiptNo,
  );
  if (direct) return direct;

  const notes = normalizeHumanText(doc.notes);
  const sourceMatch = notes.match(/Source invoice:\s*([A-Za-z0-9-_/]+)/i);
  if (sourceMatch?.[1]) return sourceMatch[1].trim();

  return firstCleanText(doc.id);
}

export function resolveTaxId(...values: unknown[]): string {
  for (const value of values) {
    const clean = normalizeHumanText(value);
    if (clean) return clean;
  }
  return '';
}

export function normalizeLineItems(items: unknown): LineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw, index) => {
    const item = (raw || {}) as AnyRecord;
    const quantity = Number(item.quantity ?? 0) || 0;
    const unitPrice = Number(item.unitPrice ?? item.price ?? item.priceAtOrder ?? item.salePrice ?? 0) || 0;
    const subtotal = Number(item.subtotal ?? item.total ?? item.lineTotal ?? quantity * unitPrice) || 0;
    return {
      id: firstCleanText(item.id, item.productId, `item-${index}`),
      description: firstCleanText(item.productName, item.name, item.description, 'Item'),
      quantity,
      unitPrice,
      rawPrice: Number(item.rawPrice ?? item.costPrice ?? unitPrice) || unitPrice,
      subtotal,
    };
  });
}

export function computeDocumentTotals(doc: AnyRecord) {
  const items = normalizeLineItems(doc.items);
  const subtotalFromItems = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const subtotal = subtotalFromItems || Number(doc.subtotal ?? doc.amount ?? doc.total ?? 0) || 0;
  const discount = Number(doc.discountAmount ?? doc.discount ?? 0) || 0;
  const explicitTaxAmount = Number(doc.taxAmount ?? doc.vat ?? 0) || 0;
  const taxRate = Number(doc.taxRate ?? doc.tax ?? 0) || 0;
  const taxAmount = explicitTaxAmount || subtotal * (taxRate / 100);
  const total = Number(doc.total ?? 0) || subtotal + taxAmount - discount;
  return { subtotal, discount, taxRate, taxAmount, total };
}

export function enrichInvoiceWithClient(invoice: Invoice, client?: Client): Invoice {
  const clientTaxId = resolveTaxId(invoice.customerTaxId, invoice.clientTaxId, client?.taxId);
  const clientAddress = firstCleanText(invoice.clientAddress, invoice.customerAddress, client?.address);
  return {
    ...invoice,
    invoiceNumber: resolveInvoiceNumber(invoice as unknown as AnyRecord),
    clientName: firstCleanText(invoice.clientName, client?.name, 'Walk-in Customer'),
    clientAddress: clientAddress || undefined,
    customerAddress: clientAddress || undefined,
    clientTaxId: clientTaxId || undefined,
    customerTaxId: clientTaxId || undefined,
    items: normalizeLineItems(invoice.items),
  };
}

export function normalizeExportPayload(type: ExportableType, doc: unknown, company: unknown) {
  const rawDoc = (doc || {}) as AnyRecord;
  const rawCompany = (company || {}) as AnyRecord;
  const counterpartKey = type === 'purchaseOrder' || type === 'payment' ? 'supplier' : 'client';
  const counterpart = ((rawDoc[counterpartKey] || {}) as AnyRecord);
  const totals = computeDocumentTotals(rawDoc);
  const clientTaxId = resolveTaxId(
    rawDoc.customerTaxId,
    rawDoc.clientTaxId,
    rawDoc.taxId,
    rawDoc.tax_id,
    rawDoc.taxNumber,
    rawDoc.customerTaxNumber,
    rawDoc.vatNumber,
    counterpart.taxId,
    counterpart.tax_id,
    counterpart.taxNumber,
    counterpart.vatNumber,
    counterpart.vat_number,
  );
  const clientAddress = firstCleanText(
    rawDoc.clientAddress,
    rawDoc.customerAddress,
    rawDoc.deliveryAddress,
    rawDoc.shippingAddress,
    rawDoc.billingAddress,
    rawDoc.address,
    counterpart.address,
  );

  return {
    company: {
      ...rawCompany,
      name: firstCleanText(rawCompany.name, 'Company'),
      address: normalizeHumanText(rawCompany.address),
      phone: normalizeHumanText(rawCompany.phone),
      email: normalizeHumanText(rawCompany.email),
      website: normalizeHumanText(rawCompany.website),
      taxId: resolveTaxId(
        rawCompany.taxId,
        rawCompany.tax_id,
        rawCompany.taxNumber,
        rawCompany.documentTaxId,
        rawCompany.financeDocumentSettings && (rawCompany.financeDocumentSettings as AnyRecord).documentTaxId,
        rawCompany.vatNumber,
        rawCompany.vat_number,
      ),
      commercialRegistry: normalizeHumanText(rawCompany.commercialRegistry),
    },
    doc: {
      ...rawDoc,
      invoiceNumber: resolveInvoiceNumber(rawDoc),
      orderNumber: firstCleanText(rawDoc.orderNumber),
      clientName: firstCleanText(rawDoc.clientName, rawDoc.customer, counterpart.name, rawDoc.supplierName),
      customer: firstCleanText(rawDoc.customer, rawDoc.clientName, counterpart.name),
      clientAddress: clientAddress || undefined,
      customerAddress: clientAddress || undefined,
      customerTaxId: clientTaxId || undefined,
      clientTaxId: clientTaxId || undefined,
      items: normalizeLineItems(rawDoc.items),
      notes: normalizeHumanText(rawDoc.notes),
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountAmount: totals.discount,
      tax: totals.taxRate,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      total: totals.total,
      [counterpartKey]: {
        ...counterpart,
        name: firstCleanText(counterpart.name, rawDoc.clientName, rawDoc.supplierName),
        address: clientAddress || normalizeHumanText(counterpart.address),
        phone: normalizeHumanText(counterpart.phone),
        email: normalizeHumanText(counterpart.email),
        taxId: clientTaxId || normalizeHumanText(counterpart.taxId),
      },
    },
  };
}
