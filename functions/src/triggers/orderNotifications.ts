import { onDocumentUpdated, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { trackOrderPurchaseConversion } from '../services/metaConversion';
import { deductComposedIngredientsOnSale } from '../services/kitchenSaleDeduction';
import { getFcmTokensForStoreOwner, getFcmTokensForUser, sendFcmMulticast } from '../services/fcmTokens';

const db = admin.firestore;

// Human-readable labels for each order status
const STATUS_MESSAGES: Record<string, { title: string; body: (id: string) => string }> = {
  confirmed:  { title: '✅ Order Confirmed',       body: (id) => `Order #${id.slice(-6)} has been confirmed` },
  preparing:  { title: '👨‍🍳 Order Being Prepared', body: (id) => `Order #${id.slice(-6)} is now being prepared` },
  ready:      { title: '🔔 Ready for Pickup',      body: (id) => `Order #${id.slice(-6)} is ready for pickup` },
  delivered:  { title: '📦 Order Delivered',       body: (id) => `Order #${id.slice(-6)} has been delivered` },
  cancelled:  { title: '❌ Order Cancelled',       body: (id) => `Order #${id.slice(-6)} was cancelled` },
};

const PAYMENT_MESSAGES: Record<string, { title: string; body: (id: string) => string }> = {
  paid:     { title: '💳 Payment Received',  body: (id) => `Payment received for order #${id.slice(-6)}` },
  refunded: { title: '↩️ Payment Refunded',  body: (id) => `Refund issued for order #${id.slice(-6)}` },
};

async function getFcmTokens(userId: string): Promise<string[]> {
  return getFcmTokensForUser(userId);
}

async function sendFcm(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  await sendFcmMulticast(tokens, title, body, data);
}

async function sendOwnerNotification(
  storeId: string,
  orderId: string,
  title: string,
  body: string,
  type: string,
): Promise<void> {
  if (!storeId) return;

  const tokens = await getFcmTokensForStoreOwner(storeId);
  await sendFcm(tokens, title, body, { storeId, type, orderId });
}

async function sendCustomerNotification(
  customerId: string,
  orderId: string,
  title: string,
  body: string,
  type: string,
): Promise<void> {
  if (!customerId) return;
  const tokens = await getFcmTokens(customerId);
  await sendFcm(tokens, title, body, { type, orderId });
}

/**
 * Firestore trigger: fires when a new order document is created.
 * Sends FCM push notification to the store owner.
 */
export const onOrderCreated = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const orderId = event.params.orderId;
    const storeId: string = data.storeId || '';
    const customerName: string = data.customerName || 'A customer';
    const total: number = data.total || 0;
    const currency: string = data.currency || 'USD';

    try {
      await sendOwnerNotification(
        storeId,
        orderId,
        '🛒 New Order Received',
        `${customerName} placed an order for ${currency} ${total.toFixed(2)}`,
        'new_order',
      );
    } catch (err) {
      console.warn('FCM new order notification failed:', err);
    }
  },
);

/**
 * Firestore trigger: fires when an order document is updated.
 * Sends FCM push notifications to:
 *   - Store owner: payment status changes
 *   - Customer: order status changes
 */
export const onOrderStatusChanged = onDocumentUpdated(
  {
    document: 'orders/{orderId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    const orderId = event.params.orderId;
    const storeId: string = after.storeId || before.storeId || '';
    const customerId: string = after.customerId || before.customerId || '';

    // Notify customer of order status change
    if (before.status !== after.status && after.status) {
      const msg = STATUS_MESSAGES[after.status as string];
      if (msg) {
        try {
          await sendCustomerNotification(customerId, orderId, msg.title, msg.body(orderId), `order_${after.status}`);
        } catch (err) {
          console.warn('FCM customer status notification failed:', err);
        }
        // Also notify owner for important status changes
        if (['returned', 'cancelled'].includes(after.status as string)) {
          try {
            await sendOwnerNotification(storeId, orderId, msg.title, msg.body(orderId), `order_${after.status}`);
          } catch (err) {
            console.warn('FCM owner status notification failed:', err);
          }
        }
      }
    }

    // Check for payment status change — notify owner
    if (before.paymentStatus !== after.paymentStatus && after.paymentStatus) {
      const msg = PAYMENT_MESSAGES[after.paymentStatus as string];
      if (msg) {
        try {
          await sendOwnerNotification(storeId, orderId, msg.title, msg.body(orderId), `payment_${after.paymentStatus}`);
        } catch (err) {
          console.warn('FCM payment status notification failed:', err);
        }
      }

      if (after.paymentStatus === 'paid') {
        try {
          await trackOrderPurchaseConversion(orderId, after as Record<string, unknown>);
        } catch (err) {
          console.warn('Meta purchase conversion tracking failed:', err);
        }
        try {
          const items = (after.items ?? after.lineItems ?? []) as Array<{
            productId?: string;
            quantity?: number;
          }>;
          if (storeId && items.length > 0) {
            await deductComposedIngredientsOnSale(storeId, orderId, items);
          }
        } catch (err) {
          console.warn('Kitchen sale deduction failed:', err);
        }
      }
    }
  },
);
