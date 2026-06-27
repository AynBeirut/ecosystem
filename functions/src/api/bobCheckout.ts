import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { activateRecurringServiceSubscriptionsFromOrder } from '../services/orderSubscriptions';
import { applyPaidOrderInventoryDeduction } from '../services/orderInventory';
import { applyTrialRevenueShareIfNeeded } from '../services/subscriptionEnforcement';
import { checkRealStoreForCommerce, commerceGuardHttpStatus } from '../services/storeCommerceGuard';

const db = admin.firestore();
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://grabio.space';

function createBobReference(orderId: string): string {
  const suffix = Date.now().toString().slice(-6);
  return `BOB-${orderId.slice(0, 8).toUpperCase()}-${suffix}`;
}

export async function createBobCheckoutSession(req: Request, res: Response) {
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
    if (!storeId) {
      return res.status(400).json({ error: 'Invalid order data: missing store' });
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
      bobEnabled?: boolean;
      bobReceiverName?: string;
      bobReceiverPhone?: string;
    };

    if (gatewaySettings.bobEnabled === false) {
      return res.status(403).json({ error: 'BOB Finance payments are disabled for this store' });
    }

    const bobReference = createBobReference(orderId);
    const receiverName = String(gatewaySettings.bobReceiverName || storeData.storeName || 'Store Owner').trim();
    const receiverPhone = String(gatewaySettings.bobReceiverPhone || storeData.phone || '').trim();

    await orderRef.update({
      paymentMethod: 'bob',
      paymentGateway: 'bob',
      paymentStatus: 'pending_bob',
      bobReference,
      bobReceiverName: receiverName,
      bobReceiverPhone: receiverPhone || null,
      bobStatus: 'awaiting_transfer',
      updatedAt: new Date().toISOString(),
    });

    const paymentUrl = `${FRONTEND_BASE_URL}/track-order?orderId=${encodeURIComponent(orderId)}&payment=bob`;
    return res.json({
      success: true,
      paymentUrl,
      orderId,
      reference: bobReference,
      message: receiverPhone
        ? `Send transfer via BOB Finance with reference ${bobReference} to ${receiverName} (${receiverPhone}).`
        : `Send transfer via BOB Finance with reference ${bobReference} to ${receiverName}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BOB checkout initialization failed';
    console.error('BOB checkout error:', error);
    return res.status(500).json({ error: message });
  }
}

export async function confirmBobCheckoutSession(req: Request, res: Response) {
  try {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: missing bearer token' });
    }

    await admin.auth().verifyIdToken(token);

    const orderId = String(req.body?.orderId || '').trim();
    const transferRef = String(req.body?.transferRef || '').trim();

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

    const nowIso = new Date().toISOString();
    await orderRef.update({
      status: 'paid',
      paymentStatus: 'paid',
      paymentCompletedAt: nowIso,
      paymentGateway: 'bob',
      bobStatus: 'confirmed',
      ...(transferRef ? { bobTransferRef: transferRef } : {}),
      updatedAt: nowIso,
    });

    try {
      await applyPaidOrderInventoryDeduction(orderId, 'bob');
    } catch (inventoryError) {
      console.error('Failed to deduct inventory after BOB payment confirmation:', inventoryError);
    }

    try {
      await applyTrialRevenueShareIfNeeded(orderId, 'bob');
    } catch (revenueShareError) {
      console.error('Failed to apply trial revenue-share after BOB payment confirmation:', revenueShareError);
    }

    try {
      await activateRecurringServiceSubscriptionsFromOrder(orderId);
    } catch (subscriptionError) {
      console.error('Failed to activate recurring subscriptions after BOB payment confirmation:', subscriptionError);
    }

    return res.json({ success: true, orderId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BOB payment confirmation failed';
    console.error('BOB confirm error:', error);
    return res.status(500).json({ error: message });
  }
}
