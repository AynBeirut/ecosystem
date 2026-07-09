import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { activateRecurringServiceSubscriptionsFromOrder } from '../services/orderSubscriptions';
import { applyPaidOrderInventoryDeduction } from '../services/orderInventory';
import { applyTrialRevenueShareIfNeeded } from '../services/subscriptionEnforcement';
import { checkRealStoreForCommerce, commerceGuardHttpStatus } from '../services/storeCommerceGuard';

const db = admin.firestore();
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://grabio.space';

function createOmtReference(orderId: string): string {
  const suffix = Date.now().toString().slice(-6);
  return `OMT-${orderId.slice(0, 8).toUpperCase()}-${suffix}`;
}

export async function createOmtCheckoutSession(req: Request, res: Response) {
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
      omtEnabled?: boolean;
      omtReceiverName?: string;
      omtReceiverPhone?: string;
    };

    if (gatewaySettings.omtEnabled === false) {
      return res.status(403).json({ error: 'OMT payments are disabled for this store' });
    }

    const omtReference = createOmtReference(orderId);
    const receiverName = String(gatewaySettings.omtReceiverName || storeData.storeName || 'Store Owner').trim();
    const receiverPhone = String(gatewaySettings.omtReceiverPhone || storeData.phone || '').trim();

    await orderRef.update({
      paymentMethod: 'omt',
      paymentGateway: 'omt',
      paymentStatus: 'pending_omt',
      omtReference,
      omtReceiverName: receiverName,
      omtReceiverPhone: receiverPhone || null,
      omtStatus: 'awaiting_transfer',
      updatedAt: new Date().toISOString(),
    });

    const paymentUrl = `${FRONTEND_BASE_URL}/track-order?orderId=${encodeURIComponent(orderId)}&payment=omt`;
    return res.json({
      success: true,
      paymentUrl,
      orderId,
      reference: omtReference,
      message: receiverPhone
        ? `Send transfer via OMT with reference ${omtReference} to ${receiverName} (${receiverPhone}).`
        : `Send transfer via OMT with reference ${omtReference} to ${receiverName}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OMT checkout initialization failed';
    console.error('OMT checkout error:', error);
    return res.status(500).json({ error: message });
  }
}

export async function confirmOmtCheckoutSession(req: Request, res: Response) {
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
      paymentGateway: 'omt',
      omtStatus: 'confirmed',
      ...(transferRef ? { omtTransferRef: transferRef } : {}),
      updatedAt: nowIso,
    });

    try {
      await applyPaidOrderInventoryDeduction(orderId, 'omt');
    } catch (inventoryError) {
      console.error('Failed to deduct inventory after OMT payment confirmation:', inventoryError);
    }

    try {
      await applyTrialRevenueShareIfNeeded(orderId, 'omt');
    } catch (revenueShareError) {
      console.error('Failed to apply trial revenue-share after OMT payment confirmation:', revenueShareError);
    }

    try {
      await activateRecurringServiceSubscriptionsFromOrder(orderId);
    } catch (subscriptionError) {
      console.error('Failed to activate recurring subscriptions after OMT payment confirmation:', subscriptionError);
    }

    return res.json({ success: true, orderId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OMT payment confirmation failed';
    console.error('OMT confirm error:', error);
    return res.status(500).json({ error: message });
  }
}
