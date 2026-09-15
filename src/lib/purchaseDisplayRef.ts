import {
  isOpaqueBusinessRef,
  normalizeDocumentDateKey,
  resolvePurchaseOrderNumber,
} from '@/lib/documentSerial';

function deriveCashBookPurchaseRef(purchase: {
  id?: string;
  importKey?: string;
  orderDate?: string;
}): string {
  const key = String(purchase.importKey || purchase.id || '').trim();
  if (!key.startsWith('lh-cashbook-')) return '';
  const short = key.replace(/^lh-cashbook-/, '').slice(0, 8);
  if (!short) return '';
  const dateKey = normalizeDocumentDateKey(purchase.orderDate);
  return `CB-${dateKey}-${short}`;
}

export function purchaseDisplayRef(purchase: {
  id?: string;
  importKey?: string;
  orderDate?: string;
  poNumber?: string;
  purchaseOrderNumber?: string;
  invoiceNumber?: string;
}): string {
  const resolved = resolvePurchaseOrderNumber(purchase);
  if (resolved) return resolved;
  const derived = deriveCashBookPurchaseRef(purchase);
  if (derived) return derived;
  return 'Draft PO';
}

export function purchaseDisplayRefStrict(purchase: {
  id?: string;
  importKey?: string;
  orderDate?: string;
  poNumber?: string;
  purchaseOrderNumber?: string;
  invoiceNumber?: string;
}): string {
  return (
    resolvePurchaseOrderNumber(purchase)
    || deriveCashBookPurchaseRef(purchase)
    || '—'
  );
}

export { isOpaqueBusinessRef };
