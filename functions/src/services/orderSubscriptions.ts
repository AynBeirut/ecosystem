import * as admin from 'firebase-admin';

const db = admin.firestore();

type OrderItemInput = {
  productId?: string;
  quantity?: number;
  price?: number;
};

type ProductInput = {
  name?: string;
  productType?: string;
  serviceBillingType?: string;
  serviceDuration?: number;
  renewalReminderDays?: number;
  price?: number;
};

function toPositiveInt(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
}

function toNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getNextBillingDate(startDate: Date, billingType: 'monthly' | 'yearly'): string {
  const next = new Date(startDate);
  if (billingType === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString();
}

export async function activateRecurringServiceSubscriptionsFromOrder(orderId: string): Promise<number> {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) {
    return 0;
  }

  const orderRef = db.collection('orders').doc(normalizedOrderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    return 0;
  }

  const orderData = (orderSnap.data() || {}) as Record<string, unknown>;
  if (orderData.recurringSubscriptionsProcessed === true) {
    return toPositiveInt(orderData.recurringSubscriptionsCount, 0);
  }

  const orderItemsRaw = Array.isArray(orderData.items) ? (orderData.items as unknown[]) : [];
  const orderItems: OrderItemInput[] = orderItemsRaw.map((item) => (item || {}) as OrderItemInput);

  const startDate = new Date();
  const startDateIso = startDate.toISOString();
  const storeId = String(orderData.storeId || '');
  const customerId = String(orderData.customerId || '');
  const customerName = String(orderData.customerName || '');

  let createdCount = 0;
  const batch = db.batch();

  for (let itemIndex = 0; itemIndex < orderItems.length; itemIndex += 1) {
    const item = orderItems[itemIndex];
    const productId = String(item.productId || '').trim();
    if (!productId) continue;

    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) continue;

    const product = (productSnap.data() || {}) as ProductInput;
    const billingType = product.serviceBillingType;
    const isRecurringService =
      product.productType === 'service' && (billingType === 'monthly' || billingType === 'yearly');

    if (!isRecurringService) continue;

    const quantity = toPositiveInt(item.quantity, 1);
    const unitPrice = toNonNegativeNumber(item.price, toNonNegativeNumber(product.price, 0));

    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      const subscriptionId = `${normalizedOrderId}_${productId}_${itemIndex}_${unitIndex + 1}`;
      const subRef = db.collection('serviceSubscriptions').doc(subscriptionId);

      batch.set(
        subRef,
        {
          serviceId: productId,
          serviceName: product.name || 'Service',
          customerId,
          customerName,
          storeId,
          orderId: normalizedOrderId,
          paymentType: billingType,
          price: unitPrice,
          startDate: startDateIso,
          nextBillingDate: getNextBillingDate(startDate, billingType),
          status: 'active',
          serviceDuration: toPositiveInt(product.serviceDuration, 0),
          renewalReminderDays: toPositiveInt(product.renewalReminderDays, billingType === 'monthly' ? 7 : 30),
          createdAt: startDateIso,
          updatedAt: startDateIso,
        },
        { merge: true }
      );

      createdCount += 1;
    }
  }

  batch.update(orderRef, {
    recurringSubscriptionsProcessed: true,
    recurringSubscriptionsCount: createdCount,
    recurringSubscriptionsProcessedAt: startDateIso,
    updatedAt: startDateIso,
  });

  await batch.commit();
  return createdCount;
}
