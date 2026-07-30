import * as admin from 'firebase-admin';
import {
  glPostOrderSaleRecognized,
  glPostOrderSaleReversal,
} from '../lib/ledger/platformGlBridge';
import {
  orderDateFromData,
  orderTotalFromData,
  resolveOrderCogsLines,
} from '../lib/ledger/resolveOrderCogs';

const COUNTED_SALE_STATUSES = new Set(['delivered', 'paid', 'completed']);

function getDb() {
  return admin.firestore();
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isCountedSaleStatus(status: unknown): boolean {
  return COUNTED_SALE_STATUSES.has(normalizeString(status).toLowerCase());
}

function isPaidPaymentStatus(paymentStatus: unknown): boolean {
  return normalizeString(paymentStatus).toLowerCase() === 'paid';
}

function isCashMethod(paymentMethod: string): boolean {
  const pm = paymentMethod.toLowerCase();
  return pm === 'cash' || pm === 'cod' || pm === 'cash_on_delivery';
}

function isPlatformOrderCashSale(paymentMethod: string): boolean {
  const pm = paymentMethod.toLowerCase();
  return pm !== 'credit' && pm !== 'on_account' && pm !== 'terms';
}

function isPlatformOrderCod(orderData: Record<string, unknown>, total: number): boolean {
  const paymentMethod = normalizeString(orderData.paymentMethod || 'cash');
  if (!isCashMethod(paymentMethod)) return false;

  const paid = Math.round((Number(orderData.amountPaid) || 0) * 100) / 100;
  return !isPaidPaymentStatus(orderData.paymentStatus) && paid < total;
}

async function hasSaleRecognizedEntry(storeId: string, orderId: string): Promise<boolean> {
  const snap = await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('sourceKey', '==', `order:${orderId}:sale-recognized`)
    .limit(1)
    .get();
  return !snap.empty;
}

async function hasSaleReversalEntry(storeId: string, orderId: string): Promise<boolean> {
  const snap = await getDb()
    .collection('stores')
    .doc(storeId)
    .collection('journalEntries')
    .where('sourceKey', '==', `order:${orderId}:reversal-order-refund`)
    .limit(1)
    .get();
  return !snap.empty;
}

export function orderNeedsSaleGl(orderData: Record<string, unknown>): boolean {
  const storeId = normalizeString(orderData.storeId);
  const total = orderTotalFromData(orderData);
  const items = Array.isArray(orderData.items) ? orderData.items : [];

  if (!storeId || total === 0 || items.length === 0) return false;

  return isCountedSaleStatus(orderData.status) || isPaidPaymentStatus(orderData.paymentStatus);
}

export async function syncOrderSaleGl(orderId: string, orderData: Record<string, unknown>): Promise<boolean> {
  if (!orderNeedsSaleGl(orderData)) return false;

  const storeId = normalizeString(orderData.storeId);
  if (!storeId) return false;

  if (await hasSaleRecognizedEntry(storeId, orderId)) {
    return false;
  }

  const items = Array.isArray(orderData.items) ? orderData.items : [];
  const total = orderTotalFromData(orderData);
  const absoluteTotal = Math.round((Math.abs(total) + Number.EPSILON) * 100) / 100;
  const paymentMethod = normalizeString(orderData.paymentMethod || 'cash') || 'cash';
  const isCodDelivery = total > 0 && isPlatformOrderCod(orderData, total);
  const cogsLines = await resolveOrderCogsLines(
    storeId,
    items as Array<{
      productId?: string;
      composedProductId?: string;
      id?: string;
      quantity?: number | string;
    }>,
  );

  const glOrder = {
    id: orderId,
    storeId,
    date: orderDateFromData(orderData),
    total: absoluteTotal,
    taxAmount: Math.round((Math.abs(Number(orderData.taxAmount) || 0) + Number.EPSILON) * 100) / 100,
    paymentMethod,
    invoiceNumber: normalizeString(orderData.invoiceNumber) || orderId,
    cogsLines,
    isCashSale: !isCodDelivery && isPlatformOrderCashSale(paymentMethod),
    isCodDelivery,
  };

  if (total < 0) {
    if (await hasSaleReversalEntry(storeId, orderId)) {
      return false;
    }

    await glPostOrderSaleReversal(storeId, glOrder, 'order-refund');
    return true;
  }

  await glPostOrderSaleRecognized(storeId, glOrder);

  return true;
}
