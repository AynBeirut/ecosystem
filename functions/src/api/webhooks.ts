import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { checkPaymentStatus } from '../services/whishPayment';
import { activateTrial, activateSubscription, activateModularSubscription } from './subscription';
import { sendTrialActivatedEmail, sendSubscriptionActivatedEmail, sendPaymentFailedEmail } from '../services/emailService';

const db = admin.firestore();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

/**
 * Handle Whish payment callback (GET request)
 * Whish calls this URL after payment: ?externalId=123&type=trial&userId=abc&status=success/failed
 */
export async function handleWhishWebhook(req: Request, res: Response) {
  try {
    console.log('Whish callback received:', req.query);
    
    const { externalId, type, userId, status } = req.query;
    
    if (!externalId || !type || !userId) {
      console.error('Missing required parameters');
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Verify payment status with Whish API
    const paymentStatus = await checkPaymentStatus(Number(externalId), 'USD');
    
    console.log('Payment status check:', paymentStatus);

    if (!paymentStatus.status || !paymentStatus.data) {
      console.error('Failed to verify payment status');
      return res.status(400).json({ error: 'Could not verify payment' });
    }

    const { collectStatus, payerPhoneNumber } = paymentStatus.data;

    // Handle based on payment status
    if (collectStatus === 'success') {
      if (type === 'trial') {
        await handleTrialSuccess(userId as string, externalId as string, payerPhoneNumber);
      } else if (type === 'subscription') {
        await handleSubscriptionSuccess(userId as string, externalId as string, payerPhoneNumber);
      } else if (type === 'subscription_modular') {
        await handleModularSubscriptionSuccess(userId as string, externalId as string, payerPhoneNumber);
      }
    } else if (collectStatus === 'failed' || status === 'failed') {
      await handlePaymentFailure(userId as string, externalId as string, type as string);
    }

    res.json({ success: true, message: 'Callback processed' });
  } catch (error: unknown) {
    console.error('Callback error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

/**
 * Handle successful trial payment
 */
async function handleTrialSuccess(
  userId: string,
  externalId: string,
  payerPhone?: string
) {
  try {
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      console.error('Store not found:', userId);
      return;
    }

    const data = storeSnap.data();
    const tier = data?.pendingTrialTier || 'trial';

    // Activate trial
    await activateTrial(userId, externalId, tier);

    // Send confirmation email
    const email = data?.email || data?.ownerEmail;
    if (email) {
      await sendTrialActivatedEmail(email, tier);
    }

    console.log(`Trial activated successfully for ${userId}`);
  } catch (error) {
    console.error('Trial activation error:', error);
    throw error;
  }
}

/**
 * Handle successful subscription payment
 */
async function handleSubscriptionSuccess(
  userId: string,
  externalId: string,
  payerPhone?: string
) {
  try {
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      console.error('Store not found:', userId);
      return;
    }

    const data = storeSnap.data();
    const tier = data?.pendingSubscriptionTier || 'starter';
    const billing = data?.pendingSubscriptionBilling || 'monthly';
    const addOns = data?.pendingSubscriptionAddOns || {};
    const amount = data?.pendingSubscriptionAmount || 0;

    // Activate subscription
    await activateSubscription(userId, externalId, tier, billing, addOns, amount);

    // Send confirmation email
    const email = data?.email || data?.ownerEmail;
    if (email) {
      await sendSubscriptionActivatedEmail(email, tier, billing, amount);
    }

    console.log(`Subscription activated successfully for ${userId}`);
  } catch (error) {
    console.error('Subscription activation error:', error);
    throw error;
  }
}

/**
 * Handle successful modular-v2 subscription payment
 */
async function handleModularSubscriptionSuccess(
  userId: string,
  externalId: string,
  payerPhone?: string,
) {
  try {
    await activateModularSubscription(userId, externalId);
    const storeSnap = await db.collection('storeProfiles').doc(userId).get();
    const email = storeSnap.data()?.email || storeSnap.data()?.ownerEmail;
    if (email) {
      await sendSubscriptionActivatedEmail(
        email,
        'modular-v2',
        storeSnap.data()?.subscriptionPlan || 'monthly',
        (Number(storeSnap.data()?.lastModularPurchaseCents) || 0) / 100,
      );
    }
    console.log(`Modular subscription activated for ${userId}`);
  } catch (error) {
    console.error('Modular subscription activation error:', error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(
  userId: string,
  externalId: string,
  type: string
) {
  try {
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    // Record failed payment
    await storeRef.set({
      lastFailedPayment: {
        externalId: externalId,
        date: new Date().toISOString(),
        type,
        reason: 'Payment failed via callback'
      },
      billingHistory: admin.firestore.FieldValue.arrayUnion({
        date: new Date().toISOString(),
        status: 'failed',
        transactionId: externalId,
        description: `${type} payment failed`
      }),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Send failure notification
    const data = storeSnap?.data();
    const email = data?.email || data?.ownerEmail;
    if (email) {
      await sendPaymentFailedEmail(email, type);
    }

    console.log(`Payment failure recorded for ${userId}`);
  } catch (error) {
    console.error('Payment failure handling error:', error);
    throw error;
  }
}
