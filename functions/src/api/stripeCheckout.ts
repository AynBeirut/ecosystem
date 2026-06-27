import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { activateRecurringServiceSubscriptionsFromOrder } from '../services/orderSubscriptions';
import { applyPaidOrderInventoryDeduction } from '../services/orderInventory';
import { applyTrialRevenueShareIfNeeded } from '../services/subscriptionEnforcement';
import { checkRealStoreForCommerce, commerceGuardHttpStatus } from '../services/storeCommerceGuard';

const db = admin.firestore();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || 'https://grabio.space').replace(/\/$/, '');

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2026-02-25.clover',
    })
  : null;

function normalizeOrderId(orderId: string | null | undefined): string {
  return typeof orderId === 'string' ? orderId.trim() : '';
}

async function markOrderPaidFromStripeSession(orderId: string, session: Stripe.Checkout.Session): Promise<void> {
  const normalizedOrderId = normalizeOrderId(orderId);
  if (!normalizedOrderId) {
    throw new Error('Missing order ID for Stripe payment finalization');
  }

  const orderRef = db.collection('orders').doc(normalizedOrderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new Error('Order not found');
  }

  const orderData = orderSnap.data();
  if (orderData?.paymentStatus === 'paid') {
    try {
      await applyPaidOrderInventoryDeduction(normalizedOrderId, 'stripe');
    } catch (inventoryError) {
      console.error('Failed to verify finished goods deduction for already-paid Stripe order:', inventoryError);
    }
    try {
      await applyTrialRevenueShareIfNeeded(normalizedOrderId, 'stripe');
    } catch (revenueShareError) {
      console.error('Failed to verify trial revenue-share for already-paid Stripe order:', revenueShareError);
    }
    await activateRecurringServiceSubscriptionsFromOrder(normalizedOrderId);
    return;
  }

  const totalAmount = Number(orderData?.total || 0);
  await orderRef.update({
    status: 'paid',
    paymentStatus: 'paid',
    amountPaid: Number.isFinite(totalAmount) ? totalAmount : 0,
    paymentDate: new Date().toISOString(),
    paymentMethod: session.metadata?.paymentMethod || orderData?.paymentMethod || 'card',
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    updatedAt: new Date().toISOString(),
  });

  try {
    await applyPaidOrderInventoryDeduction(normalizedOrderId, 'stripe');
  } catch (inventoryError) {
    console.error('Failed to deduct finished goods after Stripe payment confirmation:', inventoryError);
  }

  try {
    await applyTrialRevenueShareIfNeeded(normalizedOrderId, 'stripe');
  } catch (revenueShareError) {
    console.error('Failed to apply trial revenue-share after Stripe payment confirmation:', revenueShareError);
  }

  await activateRecurringServiceSubscriptionsFromOrder(normalizedOrderId);
}

function getStripeClient(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY');
  }
  return stripe;
}

export async function createStripeCheckoutSession(req: Request, res: Response) {
  try {
    const { orderId, paymentMethod } = req.body as { orderId?: string; paymentMethod?: string };

    if (!orderId) {
      return res.status(400).json({ error: 'Missing order ID' });
    }

    const normalizedOrderId = normalizeOrderId(orderId);
    const orderRef = db.collection('orders').doc(normalizedOrderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderSnap.data();
    const totalAmount = Number(orderData?.total || 0);
    const storeId = String(orderData?.storeId || '');

    if (!storeId || !Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ error: 'Invalid order data for Stripe checkout' });
    }

    const commerceCheck = await checkRealStoreForCommerce(db, storeId);
    if (!commerceCheck.eligible) {
      return res.status(commerceGuardHttpStatus(commerceCheck.code)).json({
        error: commerceCheck.message,
        code: commerceCheck.code,
      });
    }

    const storeProfileSnap = await db.collection('storeProfiles').doc(storeId).get();
    const storeGatewaySettings = storeProfileSnap.exists
      ? (storeProfileSnap.data()?.paymentGatewaySettings || {})
      : {};

    if (storeGatewaySettings.stripeEnabled === false) {
      return res.status(403).json({
        error: 'Stripe payments are disabled for this store',
      });
    }

    if (orderData?.paymentStatus === 'paid') {
      return res.status(409).json({ error: 'Order is already paid' });
    }

    const stripeClient = getStripeClient();
    const amountInCents = Math.round(totalAmount * 100);

    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
            product_data: {
              name: `Order ${orderData?.invoiceNumber || normalizedOrderId}`,
              description: `Store order payment`,
            },
          },
        },
      ],
      client_reference_id: normalizedOrderId,
      metadata: {
        orderId: normalizedOrderId,
        storeId,
        paymentMethod: paymentMethod || 'card',
      },
      success_url: `${FRONTEND_BASE_URL}/cart?stripe=success&orderId=${encodeURIComponent(normalizedOrderId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_BASE_URL}/cart?stripe=cancel&orderId=${encodeURIComponent(normalizedOrderId)}`,
    });

    await orderRef.update({
      paymentStatus: 'pending',
      paymentMethod: paymentMethod || 'card',
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    if (!session.url) {
      return res.status(500).json({ error: 'Stripe session created without redirect URL' });
    }

    return res.json({
      success: true,
      paymentUrl: session.url,
      orderId: normalizedOrderId,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe checkout initialization failed';
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: message });
  }
}

export async function confirmStripeCheckoutSession(req: Request, res: Response) {
  try {
    const body = req.body as { sessionId?: string; orderId?: string };
    const sessionId = body.sessionId || String(req.query.sessionId || '');
    const orderIdFromRequest = body.orderId || String(req.query.orderId || '');

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing Stripe session ID' });
    }

    const stripeClient = getStripeClient();
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    const orderIdFromSession = session.metadata?.orderId || session.client_reference_id || '';
    const orderId = normalizeOrderId(orderIdFromRequest || orderIdFromSession);

    if (!orderId) {
      return res.status(400).json({ error: 'Unable to resolve order ID for Stripe session' });
    }

    if (orderIdFromRequest && orderIdFromSession && orderIdFromRequest !== orderIdFromSession) {
      return res.status(400).json({ error: 'Order mismatch for Stripe session' });
    }

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderSnap.data();
    if (orderData?.paymentStatus === 'paid') {
      await activateRecurringServiceSubscriptionsFromOrder(orderId);
      return res.json({ success: true, orderId, paymentStatus: 'paid', alreadyPaid: true });
    }

    const isPaid = session.payment_status === 'paid';
    if (!isPaid) {
      return res.status(202).json({
        success: false,
        orderId,
        paymentStatus: 'pending',
        stripeStatus: session.payment_status,
      });
    }

    await markOrderPaidFromStripeSession(orderId, session);

    return res.json({ success: true, orderId, paymentStatus: 'paid' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe payment confirmation failed';
    console.error('Stripe confirm error:', error);
    return res.status(500).json({ error: message });
  }
}

export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');
    }

    const signature = req.headers['stripe-signature'];
    if (!signature || Array.isArray(signature)) {
      return res.status(400).send('Missing stripe-signature header');
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).send('Invalid webhook body: expected raw payload');
    }

    const stripeClient = getStripeClient();
    const event = stripeClient.webhooks.constructEvent(req.body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = normalizeOrderId(session.metadata?.orderId || session.client_reference_id || '');

      if (session.payment_status === 'paid' && orderId) {
        await markOrderPaidFromStripeSession(orderId, session);
      }
    }

    return res.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe webhook failed';
    console.error('Stripe webhook error:', error);
    return res.status(400).send(`Webhook Error: ${message}`);
  }
}
