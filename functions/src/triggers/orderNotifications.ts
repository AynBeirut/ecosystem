import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { trackOrderPurchaseConversion } from '../services/metaConversion';

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

async function sendOwnerNotification(
  storeId: string,
  orderId: string,
  title: string,
  body: string,
  type: string,
): Promise<void> {
  if (!storeId) return;

  // Look up the store owner
  const ownerSnap = await admin.firestore()
    .collection('users')
    .where('storeId', '==', storeId)
    .limit(1)
    .get();

  if (ownerSnap.empty) return;

  const ownerId = ownerSnap.docs[0].id;
  const fcmSnap = await admin.firestore()
    .collection('users')
    .doc(ownerId)
    .collection('fcmTokens')
    .get();

  const tokens = fcmSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.id).filter(Boolean);
  if (tokens.length === 0) return;

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { storeId, type, orderId },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
}

/**
 * Firestore trigger: fires when an order document is updated.
 * Sends FCM push notifications to the store owner for:
 *   - Order status changes (confirmed, preparing, ready, delivered, cancelled)
 *   - Payment status changes (paid, refunded)
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

    // Check for order status change
    if (before.status !== after.status && after.status) {
      const msg = STATUS_MESSAGES[after.status as string];
      if (msg) {
        try {
          await sendOwnerNotification(storeId, orderId, msg.title, msg.body(orderId), `order_${after.status}`);
        } catch (err) {
          console.warn('FCM order status notification failed:', err);
        }
      }
    }

    // Check for payment status change
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
      }
    }
  },
);
