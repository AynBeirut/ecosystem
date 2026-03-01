import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { initiatePayment } from '../services/whishPayment';

const db = admin.firestore();

interface SubscriptionPlan {
  tier: 'premium' | 'pro';
  billing: 'monthly' | 'yearly';
  addOns?: {
    storage?: boolean;
    customDomainHosting?: boolean;
  };
}

const PRICING = {
  trial: 100, // $1.00 in cents
  premium: {
    monthly: 1000, // $10.00
    yearly: 10000 // $100.00 (17% savings)
  },
  pro: {
    monthly: 2000, // $20.00
    yearly: 20000 // $200.00 (17% savings - should be $240)
  },
  addOns: {
    storage: {
      monthly: 500, // $5.00
      yearly: 5000 // $50.00
    },
    customDomainHosting: {
      monthly: 1000, // $10.00
      yearly: 10000 // $100.00
    }
  }
};

/**
 * Start $1 trial subscription
 */
export async function startTrial(req: Request, res: Response) {
  try {
    const { userId, email, name, tier } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already used trial
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    if (storeSnap.exists() && storeSnap.data()?.hasUsedTrial) {
      return res.status(400).json({ error: 'Trial already used' });
    }

    // Check if legacy user
    if (storeSnap.exists() && storeSnap.data()?.isLegacyUser) {
      return res.status(400).json({ error: 'Legacy users do not need trial - already have 1 year free' });
    }

    // Initialize payment with Whish
    const externalId = Date.now(); // Unique numeric ID for this transaction
    const payment = await initiatePayment({
      amount: PRICING.trial,
      currency: 'USD',
      invoice: `Grabio Trial - 1 Month for $${PRICING.trial}`,
      externalId,
      successCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=trial&userId=${userId}`,
      failureCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=trial&userId=${userId}&status=failed`,
      successRedirectUrl: `https://market-flow-7b074.web.app/payment/success?type=trial`,
      failureRedirectUrl: `https://market-flow-7b074.web.app/payment/failed?type=trial`
    });

    if (!payment.status || !payment.data?.collectUrl) {
      return res.status(500).json({ error: payment.error || 'Payment initialization failed' });
    }

    // Store pending trial with externalId
    await storeRef.set({
      pendingTrialPaymentId: externalId.toString(),
      pendingTrialExternalId: externalId,
      pendingTrialTier: tier || 'pro',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.json({
      success: true,
      paymentUrl: payment.data.collectUrl,
      externalId
    });
  } catch (error: any) {
    console.error('Start trial error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Subscribe to monthly or yearly plan
 */
export async function subscribe(req: Request, res: Response) {
  try {
    const { userId, email, name, tier, billing, addOns } = req.body;

    if (!userId || !email || !tier || !billing) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate total amount
    let amount = (PRICING as any)[tier][billing];
    let description = `Grabio ${tier.toUpperCase()} - ${billing}`;
    
    if (addOns?.storage) {
      amount += (PRICING.addOns.storage as any)[billing];
      description += ' + Extra Storage';
    }
    if (addOns?.customDomainHosting) {
      amount += (PRICING.addOns.customDomainHosting as any)[billing];
      description += ' + Custom Domain Hosting';
    }

    // Initialize payment with Whish
    const externalId = Date.now(); // Unique numeric ID for this transaction
    const payment = await initiatePayment({
      amount,
      currency: 'USD',
      invoice: description,
      externalId,
      successCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=subscription&userId=${userId}`,
      failureCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=subscription&userId=${userId}&status=failed`,
      successRedirectUrl: `https://market-flow-7b074.web.app/payment/success?type=subscription`,
      failureRedirectUrl: `https://market-flow-7b074.web.app/payment/failed?type=subscription`
    });

    if (!payment.status || !payment.data?.collectUrl) {
      return res.status(500).json({ error: payment.error || 'Payment initialization failed' });
    }

    // Store pending subscription
    const storeRef = db.collection('storeProfiles').doc(userId);
    await storeRef.set({
      pendingSubscriptionPaymentId: externalId.toString(),
      pendingSubscriptionExternalId: externalId,
      pendingSubscriptionTier: tier,
      pendingSubscriptionBilling: billing,
      pendingSubscriptionAddOns: addOns || {},
      pendingSubscriptionAmount: amount,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.json({
      success: true,
      paymentUrl: payment.data.collectUrl,
      externalId,
      amount: amount // Already in dollars
    });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Activate trial after successful payment
 */
export async function activateTrial(userId: string, paymentId: string, tier: string) {
  const storeRef = db.collection('storeProfiles').doc(userId);
  
  const trialEndsAt = new Date();
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 1); // 1 month trial

  await storeRef.set({
    subscriptionStatus: 'trial',
    subscriptionTier: tier,
    isTrialUser: true,
    hasUsedTrial: true,
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    subscriptionEndsAt: trialEndsAt.toISOString(),
    lastPaymentDate: new Date().toISOString(),
    lastPaymentAmount: 1,
    trialPaymentId: paymentId,
    billingHistory: admin.firestore.FieldValue.arrayUnion({
      date: new Date().toISOString(),
      amount: 1,
      plan: 'monthly',
      tier,
      status: 'success',
      transactionId: paymentId,
      description: 'Trial - 1 month for $1'
    }),
    pendingTrialPaymentId: admin.firestore.FieldValue.delete(),
    pendingTrialTier: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log(`Trial activated for user ${userId}`);
}

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(
  userId: string,
  paymentId: string,
  tier: string,
  billing: 'monthly' | 'yearly',
  addOns: any,
  amount: number
) {
  const storeRef = db.collection('storeProfiles').doc(userId);
  
  const subscriptionEndsAt = new Date();
  if (billing === 'monthly') {
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
  } else {
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
  }

  await storeRef.set({
    subscriptionStatus: 'active',
    subscriptionTier: tier,
    subscriptionPlan: billing,
    subscriptionStartedAt: new Date().toISOString(),
    subscriptionEndsAt: subscriptionEndsAt.toISOString(),
    nextBillingDate: subscriptionEndsAt.toISOString(),
    lastPaymentDate: new Date().toISOString(),
    lastPaymentAmount: amount / 100, // Store in dollars
    addOns,
    billingHistory: admin.firestore.FieldValue.arrayUnion({
      date: new Date().toISOString(),
      amount: amount / 100,
      plan: billing,
      tier,
      status: 'success',
      transactionId: paymentId,
      description: `${tier.toUpperCase()} - ${billing}`
    }),
    pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
    pendingSubscriptionTier: admin.firestore.FieldValue.delete(),
    pendingSubscriptionBilling: admin.firestore.FieldValue.delete(),
    pendingSubscriptionAddOns: admin.firestore.FieldValue.delete(),
    pendingSubscriptionAmount: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log(`Subscription activated for user ${userId}: ${tier} ${billing}`);
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(req: Request, res: Response) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists()) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const data = storeSnap.data();
    
    // Don't allow cancelling legacy users' free access
    if (data?.isLegacyUser) {
      return res.status(400).json({ error: 'Cannot cancel legacy user subscription' });
    }

    await storeRef.update({
      subscriptionStatus: 'cancelled',
      cancelledAt: new Date().toISOString(),
      // Keep access until current period ends
      subscriptionEndsAt: data?.subscriptionEndsAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({ 
      success: true, 
      message: 'Subscription cancelled. Access will continue until ' + 
        new Date(data?.subscriptionEndsAt).toLocaleDateString()
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get subscription info
 */
export async function getSubscriptionInfo(req: Request, res: Response) {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists()) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const data = storeSnap.data();

    res.json({
      success: true,
      subscription: {
        status: data?.subscriptionStatus || 'inactive',
        tier: data?.subscriptionTier,
        plan: data?.subscriptionPlan,
        isLegacyUser: data?.isLegacyUser || false,
        isTrial: data?.isTrialUser || false,
        expiresAt: data?.subscriptionEndsAt,
        nextBillingDate: data?.nextBillingDate,
        addOns: data?.addOns || {},
        billingHistory: data?.billingHistory || []
      }
    });
  } catch (error: any) {
    console.error('Get subscription info error:', error);
    res.status(500).json({ error: error.message });
  }
}
