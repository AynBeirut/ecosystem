import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { activateRecurringServiceSubscriptionsFromOrder } from '../services/orderSubscriptions';
import { applyPaidOrderInventoryDeduction } from '../services/orderInventory';
import { applyTrialRevenueShareIfNeeded } from '../services/subscriptionEnforcement';
import { checkRealStoreForCommerce, commerceGuardHttpStatus } from '../services/storeCommerceGuard';

const db = admin.firestore();

const SQUARE_BASE_URL = process.env.SQUARE_BASE_URL || 'https://connect.squareup.com';
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
const DEFAULT_SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://grabio.space';

type SquarePaymentLinkResponse = {
  payment_link?: {
    id?: string;
    url?: string;
    order_id?: string;
  };
  related_resources?: {
    orders?: Array<{ id?: string }>;
  };
  errors?: Array<{ code?: string; detail?: string }>;
};

type SquareOrderResponse = {
  order?: {
    id?: string;
    state?: string;
    net_amount_due_money?: { amount?: number };
  };
  errors?: Array<{ code?: string; detail?: string }>;
};

function getSquareHeaders() {
  if (!SQUARE_ACCESS_TOKEN) {
    throw new Error('Square is not configured. Missing SQUARE_ACCESS_TOKEN');
  }

  return {
    Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Square-Version': '2024-07-17',
  };
}

function extractSquareErrorMessage(payload: unknown): string {
  const errors = (payload as { errors?: Array<{ detail?: string; code?: string }> })?.errors || [];
  if (!Array.isArray(errors) || errors.length === 0) return 'Unknown Square API error';
  return errors.map((err) => err.detail || err.code || 'Unknown error').join('; ');
}

export async function createSquareCheckoutSession(req: Request, res: Response) {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order ID' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderSnap.data() || {};
    const storeId = String(orderData.storeId || '').trim();
    const totalAmount = Number(orderData.total || 0);
    if (!storeId || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid order data for Square checkout' });
    }

    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      return res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
    }

    const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeSnap.exists) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const storeData = storeSnap.data() || {};
    const gatewaySettings = (storeData.paymentGatewaySettings || {}) as {
      squareEnabled?: boolean;
      squareLocationId?: string;
    };

    if (gatewaySettings.squareEnabled === false) {
      return res.status(403).json({ error: 'Square payments are disabled for this store' });
    }

    const locationId = String(gatewaySettings.squareLocationId || DEFAULT_SQUARE_LOCATION_ID || '').trim();
    if (!locationId) {
      return res.status(400).json({ error: 'Missing Square location ID. Configure squareLocationId in store settings.' });
    }

    const amountInCents = Math.round(totalAmount * 100);
    const idempotencyKey = `square-${orderId}-${Date.now()}`;

    const response = await axios.post<SquarePaymentLinkResponse>(
      `${SQUARE_BASE_URL}/v2/online-checkout/payment-links`,
      {
        idempotency_key: idempotencyKey,
        order: {
          location_id: locationId,
          reference_id: orderId,
          line_items: [
            {
              name: `Order #${orderId}`,
              quantity: '1',
              base_price_money: {
                amount: amountInCents,
                currency: 'USD',
              },
            },
          ],
        },
        checkout_options: {
          redirect_url: `${FRONTEND_BASE_URL}/cart?square=success&orderId=${encodeURIComponent(orderId)}`,
        },
      },
      {
        headers: getSquareHeaders(),
        timeout: 30000,
      },
    );

    const paymentLink = response.data?.payment_link;
    const paymentUrl = String(paymentLink?.url || '').trim();
    const squarePaymentLinkId = String(paymentLink?.id || '').trim();
    const squareOrderId = String(
      paymentLink?.order_id || response.data?.related_resources?.orders?.[0]?.id || '',
    ).trim();

    if (!paymentUrl) {
      return res.status(500).json({ error: `Square checkout initialization failed: ${extractSquareErrorMessage(response.data)}` });
    }

    await orderRef.update({
      paymentMethod: 'square',
      paymentGateway: 'square',
      paymentStatus: 'pending',
      squarePaymentLinkId: squarePaymentLinkId || null,
      squareOrderId: squareOrderId || null,
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      success: true,
      paymentUrl,
      orderId,
      squarePaymentLinkId,
      squareOrderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Square checkout initialization failed';
    console.error('Square checkout error:', error);
    return res.status(500).json({ error: message });
  }
}

export async function confirmSquareCheckoutSession(req: Request, res: Response) {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order ID' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderSnap.data() || {};
    if (orderData.paymentStatus === 'paid') {
      return res.json({ success: true, alreadyPaid: true, orderId });
    }

    const squareOrderId = String(orderData.squareOrderId || '').trim();
    if (!squareOrderId) {
      return res.status(400).json({ error: 'Missing Square order reference on this order' });
    }

    const storeId = String(orderData.storeId || '').trim();
    const storeSnap = storeId ? await db.collection('storeProfiles').doc(storeId).get() : null;
    const storeData = storeSnap?.exists ? (storeSnap.data() || {}) : {};
    const storeLocationId = String((storeData as { paymentGatewaySettings?: { squareLocationId?: string } })?.paymentGatewaySettings?.squareLocationId || '').trim();
    const resolvedLocationId = storeLocationId || DEFAULT_SQUARE_LOCATION_ID;

    const response = await axios.get<SquareOrderResponse>(
      `${SQUARE_BASE_URL}/v2/orders/${encodeURIComponent(squareOrderId)}`,
      {
        headers: getSquareHeaders(),
        params: resolvedLocationId ? { location_id: resolvedLocationId } : undefined,
        timeout: 30000,
      },
    );

    const squareOrder = response.data?.order;
    const orderState = String(squareOrder?.state || '').toUpperCase();
    const dueAmount = Number(squareOrder?.net_amount_due_money?.amount ?? 1);
    const isPaid = orderState === 'COMPLETED' || dueAmount === 0;

    if (!isPaid) {
      return res.status(202).json({
        success: false,
        status: 'pending',
        orderId,
        squareOrderState: orderState || 'PENDING',
      });
    }

    const total = Number(orderData.total || 0);
    await orderRef.update({
      status: 'paid',
      paymentStatus: 'paid',
      paymentCompletedAt: new Date().toISOString(),
      paymentAmount: total,
      paymentGateway: 'square',
      updatedAt: new Date().toISOString(),
    });

    try {
      await applyPaidOrderInventoryDeduction(orderId, 'square');
    } catch (inventoryError) {
      console.error('Failed to deduct finished goods after Square payment confirmation:', inventoryError);
    }

    try {
      await applyTrialRevenueShareIfNeeded(orderId, 'square');
    } catch (revenueShareError) {
      console.error('Failed to apply trial revenue-share after Square payment confirmation:', revenueShareError);
    }

    try {
      await activateRecurringServiceSubscriptionsFromOrder(orderId);
    } catch (subscriptionError) {
      console.error('Failed to activate recurring service subscriptions after Square payment confirmation:', subscriptionError);
    }

    return res.json({ success: true, orderId, squareOrderState: orderState || 'COMPLETED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Square payment confirmation failed';
    console.error('Square confirm error:', error);
    return res.status(500).json({ error: message });
  }
}
