import type { Order } from '@/types/order';

const OPAQUE_DOCUMENT_REF_RE = /^(?:pos-[A-Za-z0-9_-]{8,}(?:-[A-Za-z0-9_-]+)?|[A-Za-z0-9_-]{18,})$/i;

const isHumanDocumentRef = (value?: string | null): value is string => {
  const ref = String(value || '').trim();
  return Boolean(ref) && !OPAQUE_DOCUMENT_REF_RE.test(ref);
};

export const hasHumanOrderDocumentRef = (
  order: Pick<Order, 'invoiceNumber' | 'orderNumber'>,
): boolean => isHumanDocumentRef(order.invoiceNumber) || isHumanDocumentRef(order.orderNumber);

export const resolveOrderDocumentRef = (
  order: Pick<Order, 'invoiceNumber' | 'orderNumber'>,
): string => {
  if (isHumanDocumentRef(order.invoiceNumber)) return order.invoiceNumber.trim();
  if (isHumanDocumentRef(order.orderNumber)) return order.orderNumber.trim();
  return 'INV-PENDING';
};

export const safeDocumentFilePart = (value: string): string =>
  value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'UNNUMBERED';
