import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { initiatePayment, resolvePlatformWebsiteUrl, resolveFrontendBaseUrl } from '../services/whishPayment';
import {
  calculateModularAmountCents,
  modularActivationPatch,
  MODULE_PRICES,
  ADDON_PRICING,
} from '../lib/modularPricing';
import { PACKAGE_PRESETS } from '../lib/moduleManifest';
import { buildRenewalMigrationPatch } from '../lib/legacyPlanMapping';
import type { StartingPackageKey } from '../lib/moduleManifest';
import Stripe from 'stripe';
import { assertNotDemoStoreProfile } from '../services/storeCommerceGuard';

const db = admin.firestore();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || 'https://grabio.space').replace(/\/$/, '');
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' as Stripe.LatestApiVersion })
  : null;

type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'business';
type PaidTier = Exclude<SubscriptionTier, 'trial'>;
type Billing = 'monthly' | 'yearly';

interface SubscriptionPlan {
  tier: SubscriptionTier;
  billing: Billing;
  addOns?: {
    domainPackage?: boolean;
    whatsappBusiness?: boolean;
    salesCrm?: boolean;
    extraStorageBlocks?: number;
  };
}

const PRICING = {
  starter: {
    monthly: 1000,
    yearly: 10000,
  },
  pro: {
    monthly: 2000,
    yearly: 20000,
  },
  business: {
    monthly: 3000,
    yearly: 30000,
  },
  addOns: {
    domainPackage: {
      monthly: 1500,
      yearly: 15000,
    },
    whatsappBusiness: {
      monthly: 1000, // $10.00
      yearly: 10000,
    },
    extraStoragePer5Gb: {
      monthly: 200,
      yearly: 2400,
    },
    salesCrm: {
      monthly: 1500,
      yearly: 15000,
    },
  },
};

const PLAN_LIMITS: Record<SubscriptionTier, {
  productLimit: number;
  storageLimitMb: number;
  operationsPerMonth: number | null;
  revenueSharePercentage: number;
  allowsComposed: boolean;
  allowsManufacturing: boolean;
}> = {
  trial: {
    productLimit: 10,
    storageLimitMb: 500,
    operationsPerMonth: 30,
    revenueSharePercentage: 20,
    allowsComposed: false,
    allowsManufacturing: false,
  },
  starter: {
    productLimit: 8,
    storageLimitMb: 5120,
    operationsPerMonth: null,
    revenueSharePercentage: 0,
    allowsComposed: true,
    allowsManufacturing: false,
  },
  pro: {
    productLimit: 20,
    storageLimitMb: 10240,
    operationsPerMonth: null,
    revenueSharePercentage: 0,
    allowsComposed: true,
    allowsManufacturing: true,
  },
  business: {
    productLimit: 50,
    storageLimitMb: 20480,
    operationsPerMonth: null,
    revenueSharePercentage: 0,
    allowsComposed: true,
    allowsManufacturing: true,
  },
};

const TRIAL_DURATION_MONTHS = 3;
const TRIAL_GRACE_DAYS = 15;

function normalizeTier(tier?: string): SubscriptionTier {
  if (!tier) return 'starter';
  if (tier === 'premium') return 'starter';
  if (tier === 'trial' || tier === 'starter' || tier === 'pro' || tier === 'business') {
    return tier;
  }
  return 'starter';
}

function normalizePaidTier(tier?: string): PaidTier {
  const normalizedTier = normalizeTier(tier);
  if (normalizedTier === 'trial') return 'starter';
  return normalizedTier;
}

function normalizeAddOns(addOns: unknown): {
  domainPackage: boolean;
  whatsappBusiness: boolean;
  salesCrm: boolean;
  extraStorageBlocks: number;
} {
  if (Array.isArray(addOns)) {
    return {
      domainPackage: addOns.includes('domainPackage') || addOns.includes('customDomainHosting'),
      whatsappBusiness: addOns.includes('whatsappBusiness'),
      salesCrm: addOns.includes('salesCrm'),
      extraStorageBlocks: addOns.includes('extraStorage') || addOns.includes('storage') ? 1 : 0,
    };
  }

  const value = (addOns && typeof addOns === 'object' ? addOns : {}) as Record<string, unknown>;

  return {
    domainPackage: Boolean(value.domainPackage || value.customDomainHosting),
    whatsappBusiness: Boolean(value.whatsappBusiness),
    salesCrm: Boolean(value.salesCrm),
    extraStorageBlocks: Math.max(0, Number(value.extraStorageBlocks || (value.storage ? 1 : 0) || 0)),
  };
}

function getAddOnArray(addOns: ReturnType<typeof normalizeAddOns>): string[] {
  const result: string[] = [];
  if (addOns.domainPackage) result.push('domainPackage');
  if (addOns.whatsappBusiness) result.push('whatsappBusiness');
  if (addOns.salesCrm) result.push('salesCrm');
  if (addOns.extraStorageBlocks > 0) result.push('extraStorage');
  return result;
}

function mergeAddOnMeta(
  existing: Record<string, unknown> | undefined,
  incoming: ReturnType<typeof normalizeAddOns>,
): ReturnType<typeof normalizeAddOns> {
  const base = normalizeAddOns(existing);
  return {
    domainPackage: base.domainPackage || incoming.domainPackage,
    whatsappBusiness: base.whatsappBusiness || incoming.whatsappBusiness,
    salesCrm: base.salesCrm || incoming.salesCrm,
    extraStorageBlocks: Math.max(base.extraStorageBlocks, incoming.extraStorageBlocks),
  };
}

function calculateAmount(tier: PaidTier, billing: Billing, addOnsInput: unknown): { amount: number; description: string; addOns: ReturnType<typeof normalizeAddOns> } {
  const addOns = normalizeAddOns(addOnsInput);
  let amount = PRICING[tier][billing];
  let description = `Grabio ${tier.toUpperCase()} - ${billing}`;

  if (addOns.domainPackage) {
    amount += PRICING.addOns.domainPackage[billing];
    description += ' + Domain Package';
  }
  if (addOns.whatsappBusiness) {
    amount += PRICING.addOns.whatsappBusiness[billing];
    description += ' + WhatsApp Business';
  }
  if (addOns.extraStorageBlocks > 0) {
    amount += addOns.extraStorageBlocks * PRICING.addOns.extraStoragePer5Gb[billing];
    description += ` + ${addOns.extraStorageBlocks}x Extra Storage`; 
  }
  if (addOns.salesCrm) {
    amount += PRICING.addOns.salesCrm[billing];
    description += ' + Sales CRM';
  }

  return { amount, description, addOns };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

/**
 * Start trial subscription
 */
export async function startTrial(req: Request, res: Response) {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await assertNotDemoStoreProfile(db, userId);

    // Check if user already used trial
    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();
    
    if (storeSnap.exists && storeSnap.data()?.hasUsedTrial) {
      return res.status(400).json({ error: 'Trial already used' });
    }

    // Check if legacy user
    if (storeSnap.exists && storeSnap.data()?.isLegacyUser) {
      return res.status(400).json({ error: 'Legacy users do not need trial - already have 1 year free' });
    }

    const activationId = `TRIAL_${Date.now()}`;
    await activateTrial(userId, activationId, 'trial');

    res.json({
      success: true,
      activated: true,
      tier: 'trial',
      trialMonths: TRIAL_DURATION_MONTHS,
      trialGraceDays: TRIAL_GRACE_DAYS,
      cardVerificationRequired: true,
    });
  } catch (error: unknown) {
    console.error('Start trial error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
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

    await assertNotDemoStoreProfile(db, userId);

    const normalizedTier = normalizePaidTier(tier);
    const normalizedBilling: Billing = billing === 'yearly' ? 'yearly' : 'monthly';

    // Calculate total amount
    const { amount, description, addOns: normalizedAddOns } = calculateAmount(normalizedTier, normalizedBilling, addOns);

    // Initialize payment with Whish — detect which merchant domain the request came from
    const websiteUrl = resolvePlatformWebsiteUrl(req.headers.origin as string | undefined);
    const frontendBase = resolveFrontendBaseUrl(req.headers.origin as string | undefined);
    const externalId = Date.now(); // Unique numeric ID for this transaction
    const payment = await initiatePayment({
      amount,
      currency: 'USD',
      invoice: description,
      externalId,
      websiteUrl,
      successCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=subscription&userId=${userId}`,
      failureCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=subscription&userId=${userId}&status=failed`,
      successRedirectUrl: `${frontendBase}/payment/success?type=subscription`,
      failureRedirectUrl: `${frontendBase}/payment/failed?type=subscription`
    });

    if (!payment.status || !payment.data?.collectUrl) {
      return res.status(502).json({
        error: payment.error || 'Payment initialization failed',
        code: payment.code || 'WHISH_ERROR',
        provider: 'whish',
      });
    }

    // Store pending subscription
    const storeRef = db.collection('storeProfiles').doc(userId);
    await storeRef.set({
      pendingSubscriptionPaymentId: externalId.toString(),
      pendingSubscriptionExternalId: externalId,
      pendingSubscriptionTier: normalizedTier,
      pendingSubscriptionBilling: normalizedBilling,
      pendingSubscriptionAddOns: normalizedAddOns,
      pendingSubscriptionAmount: amount,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.json({
      success: true,
      paymentUrl: payment.data.collectUrl,
      externalId,
      amount: amount // Already in dollars
    });
  } catch (error: unknown) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

/**
 * Activate trial after successful payment
 */
export async function activateTrial(userId: string, paymentId: string, tier: string) {
  await assertNotDemoStoreProfile(db, userId);
  const storeRef = db.collection('storeProfiles').doc(userId);
  const normalizedTier: SubscriptionTier = 'trial';
  const trialAmount = 0;
  const limits = PLAN_LIMITS.trial;
  
  const trialEndsAt = new Date();
  trialEndsAt.setMonth(trialEndsAt.getMonth() + TRIAL_DURATION_MONTHS);

  const trialGraceEndsAt = new Date(trialEndsAt);
  trialGraceEndsAt.setDate(trialGraceEndsAt.getDate() + TRIAL_GRACE_DAYS);

  await storeRef.set({
    subscriptionStatus: 'trial',
    subscriptionTier: normalizedTier,
    subscriptionPlan: 'monthly',
    isTrialUser: true,
    hasUsedTrial: true,
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: trialEndsAt.toISOString(),
    trial_start_date: new Date().toISOString(),
    trial_end_date: trialEndsAt.toISOString(),
    trialGraceEndsAt: trialGraceEndsAt.toISOString(),
    trialGraceDays: TRIAL_GRACE_DAYS,
    subscriptionEndsAt: trialEndsAt.toISOString(),
    nextBillingDate: trialEndsAt.toISOString(),
    lastPaymentDate: new Date().toISOString(),
    lastPaymentAmount: trialAmount,
    trialPaymentId: paymentId,
    productLimit: limits.productLimit,
    storageLimitMb: limits.storageLimitMb,
    storage_limit_mb: limits.storageLimitMb,
    monthlyOperationsLimit: limits.operationsPerMonth,
    monthly_operations_limit: limits.operationsPerMonth,
    monthlyOperationsCount: 0,
    monthly_operations_count: 0,
    revenueSharePercentage: limits.revenueSharePercentage,
    revenue_share_percentage: limits.revenueSharePercentage,
    allowsComposedProducts: limits.allowsComposed,
    allowsManufacturing: limits.allowsManufacturing,
    requiresCardVerification: true,
    billingHistory: admin.firestore.FieldValue.arrayUnion({
      date: new Date().toISOString(),
      amount: trialAmount,
      plan: 'monthly',
      tier: normalizedTier,
      status: 'success',
      transactionId: paymentId,
      description: 'Trial plan - up to 3 months, 20% revenue share'
    }),
    pendingTrialPaymentId: admin.firestore.FieldValue.delete(),
    pendingTrialExternalId: admin.firestore.FieldValue.delete(),
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
  billing: Billing,
  addOns: unknown,
  amount: number
) {
  await assertNotDemoStoreProfile(db, userId);
  const storeRef = db.collection('storeProfiles').doc(userId);
  const storeSnap = await storeRef.get();
  const existingProfile = storeSnap.exists ? storeSnap.data() : {};
  const normalizedTier = normalizePaidTier(tier);
  const incomingAddOns = normalizeAddOns(addOns);
  const normalizedAddOns = mergeAddOnMeta(
    (existingProfile?.addOnsMeta as Record<string, unknown> | undefined) ?? existingProfile?.addOns,
    incomingAddOns,
  );
  const limits = PLAN_LIMITS[normalizedTier];
  
  const subscriptionEndsAt = new Date();
  if (billing === 'monthly') {
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);
  } else {
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);
  }

  await storeRef.set({
    subscriptionStatus: 'active',
    subscriptionTier: normalizedTier,
    subscriptionPlan: billing,
    subscriptionStartedAt: new Date().toISOString(),
    subscriptionEndsAt: subscriptionEndsAt.toISOString(),
    nextBillingDate: subscriptionEndsAt.toISOString(),
    lastPaymentDate: new Date().toISOString(),
    lastPaymentAmount: amount / 100, // Store in dollars
    addOns: (() => {
      const existingList = Array.isArray(existingProfile?.addOns)
        ? (existingProfile.addOns as string[])
        : getAddOnArray(normalizeAddOns(existingProfile?.addOnsMeta ?? existingProfile?.addOns));
      return [...new Set([...existingList, ...getAddOnArray(normalizedAddOns)])];
    })(),
    addOnsMeta: normalizedAddOns,
    ...(normalizedAddOns.salesCrm
      ? {
          crmSettings: {
            noContactAlertDays:
              (existingProfile?.crmSettings as { noContactAlertDays?: number } | undefined)?.noContactAlertDays ?? 7,
          },
        }
      : {}),
    productLimit: limits.productLimit,
    storageLimitMb: limits.storageLimitMb,
    storage_limit_mb: limits.storageLimitMb,
    monthlyOperationsLimit: limits.operationsPerMonth,
    monthly_operations_limit: limits.operationsPerMonth,
    revenueSharePercentage: limits.revenueSharePercentage,
    revenue_share_percentage: limits.revenueSharePercentage,
    allowsComposedProducts: limits.allowsComposed,
    allowsManufacturing: limits.allowsManufacturing,
    trialStartedAt: admin.firestore.FieldValue.delete(),
    trialEndsAt: admin.firestore.FieldValue.delete(),
    trial_start_date: admin.firestore.FieldValue.delete(),
    trial_end_date: admin.firestore.FieldValue.delete(),
    trialGraceEndsAt: admin.firestore.FieldValue.delete(),
    trialGraceDays: admin.firestore.FieldValue.delete(),
    billingHistory: admin.firestore.FieldValue.arrayUnion({
      date: new Date().toISOString(),
      amount: amount / 100,
      plan: billing,
      tier: normalizedTier,
      status: 'success',
      transactionId: paymentId,
      description: `${normalizedTier.toUpperCase()} - ${billing}`
    }),
    pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
    pendingSubscriptionExternalId: admin.firestore.FieldValue.delete(),
    pendingSubscriptionTier: admin.firestore.FieldValue.delete(),
    pendingSubscriptionBilling: admin.firestore.FieldValue.delete(),
    pendingSubscriptionAddOns: admin.firestore.FieldValue.delete(),
    pendingSubscriptionAmount: admin.firestore.FieldValue.delete(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log(`Subscription activated for user ${userId}: ${normalizedTier} ${billing}`);
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

    if (!storeSnap.exists) {
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
  } catch (error: unknown) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

/**
 * Get subscription info
 */
export async function getSubscriptionInfo(req: Request, res: Response) {
  try {
    let userId = req.query.userId as string | undefined;

    if (!userId) {
      const authHeader = req.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (token) {
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const storeRef = db.collection('storeProfiles').doc(userId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      // New user with no store profile — return default inactive subscription
      return res.json({
        success: true,
        subscription: {
          status: 'inactive',
          tier: 'trial',
          plan: null,
          isLegacyUser: false,
          isTrial: false,
          expiresAt: null,
          nextBillingDate: null,
          addOns: [],
          addOnsMeta: {},
          limits: {
            productLimit: null,
            storageLimitMb: null,
            monthlyOperationsLimit: null,
            revenueSharePercentage: null,
          },
          billingHistory: []
        }
      });
    }

    const data = storeSnap.data();

    res.json({
      success: true,
      subscription: {
        status: data?.subscriptionStatus || 'inactive',
        tier: normalizeTier(data?.subscriptionTier),
        plan: data?.subscriptionPlan,
        isLegacyUser: data?.isLegacyUser || false,
        isTrial: data?.isTrialUser || false,
        expiresAt: data?.subscriptionEndsAt,
        nextBillingDate: data?.nextBillingDate,
        addOns: data?.addOns || [],
        addOnsMeta: data?.addOnsMeta || {},
        limits: {
          productLimit: data?.productLimit,
          storageLimitMb: data?.storageLimitMb,
          monthlyOperationsLimit: data?.monthlyOperationsLimit,
          revenueSharePercentage: data?.revenueSharePercentage,
        },
        billingHistory: data?.billingHistory || []
      }
    });
  } catch (error: unknown) {
    console.error('Get subscription info error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

/**
 * Subscribe via Stripe (card payment)
 */
export async function subscribeStripe(req: Request, res: Response) {
  if (!stripe) {
    return res.status(503).json({ error: 'Card payments not configured' });
  }

  try {
    const { userId, email, name, tier, billing, addOns } = req.body;

    if (!userId || !email || !tier || !billing) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await assertNotDemoStoreProfile(db, userId);

    const normalizedTier = normalizePaidTier(tier);
    const normalizedBilling: Billing = billing === 'yearly' ? 'yearly' : 'monthly';
    const { amount, description, addOns: normalizedAddOns } = calculateAmount(normalizedTier, normalizedBilling, addOns);

    // Amount is stored in cents-equivalent (e.g. 1000 = $10.00)
    const amountInCents = amount * 100;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountInCents,
            product_data: { name: description },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'subscription',
        userId,
        tier: normalizedTier,
        billing: normalizedBilling,
      },
      success_url: `${FRONTEND_BASE_URL}/payment/success?type=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_BASE_URL}/admin/subscription`,
    });

    // Store pending subscription so webhook can activate it
    const storeRef = db.collection('storeProfiles').doc(userId);
    await storeRef.set({
      pendingSubscriptionPaymentId: session.id,
      pendingSubscriptionExternalId: session.id,
      pendingSubscriptionTier: normalizedTier,
      pendingSubscriptionBilling: normalizedBilling,
      pendingSubscriptionAddOns: normalizedAddOns,
      pendingSubscriptionAmount: amount,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({ success: true, paymentUrl: session.url, amount });
  } catch (error: unknown) {
    console.error('Subscribe Stripe error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

type ModularBilling = 'monthly' | 'yearly';

function isValidPreset(preset: string): preset is StartingPackageKey {
  return (
    preset === 'pkg_shop' ||
    preset === 'pkg_live_kitchen' ||
    preset === 'pkg_factory_flow' ||
    preset === 'pkg_ngo' ||
    preset === 'pkg_freelancer'
  );
}

/**
 * Modular-v2 checkout — charges exactly calculateCustomPrice() (same as web UI).
 */
export async function subscribeModular(req: Request, res: Response) {
  try {
    const {
      userId,
      email,
      preset,
      billing,
      seatCount,
      posLocationCount,
      enabledModuleIds,
      addOnKeys,
    } = req.body;

    if (!userId || !email || !billing) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await assertNotDemoStoreProfile(db, userId);

    const moduleIds = Array.isArray(enabledModuleIds)
      ? enabledModuleIds.map(String).filter(Boolean)
      : [];

    if (moduleIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one module' });
    }

    const unknownModule = moduleIds.find((id) => !MODULE_PRICES[id]);
    if (unknownModule) {
      return res.status(400).json({ error: `Unknown module: ${unknownModule}` });
    }

    const normalizedBilling: ModularBilling = billing === 'yearly' ? 'yearly' : 'monthly';
    const seats = Math.max(1, Number(seatCount) || 1);
    const posLocs = Math.max(0, Number(posLocationCount) || 0);
    const addOnKeyList = Array.isArray(addOnKeys)
      ? addOnKeys.map(String).filter((k) => ADDON_PRICING[k])
      : [];

    const presetKey = preset && isValidPreset(String(preset)) ? (preset as StartingPackageKey) : null;
    const presetLabel = presetKey ? PACKAGE_PRESETS[presetKey].label : 'Custom';

    const { amountCents, totalUsd, description } = calculateModularAmountCents({
      moduleIds,
      addOnKeys: addOnKeyList,
      seatCount: seats,
      posLocationCount: posLocs,
      billing: normalizedBilling,
      presetLabel,
    });

    if (amountCents <= 0) {
      return res.status(400).json({ error: 'Invalid checkout amount' });
    }

    const websiteUrl = resolvePlatformWebsiteUrl(req.headers.origin as string | undefined);
    const frontendBase = resolveFrontendBaseUrl(req.headers.origin as string | undefined);
    const externalId = Date.now();
    const amountUsd = totalUsd;

    const payment = await initiatePayment({
      amount: amountUsd,
      currency: 'USD',
      invoice: description,
      externalId,
      websiteUrl,
      successCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=subscription_modular&userId=${userId}`,
      failureCallbackUrl: `https://us-central1-market-flow-7b074.cloudfunctions.net/api/webhook/whish?externalId=${externalId}&type=subscription_modular&userId=${userId}&status=failed`,
      successRedirectUrl: `${frontendBase}/payment/success?type=subscription_modular&externalId=${externalId}`,
      failureRedirectUrl: `${frontendBase}/payment/failed?type=subscription_modular`,
    });

    if (!payment.status || !payment.data?.collectUrl) {
      return res.status(502).json({
        error: payment.error || 'Payment initialization failed',
        code: payment.code || 'WHISH_ERROR',
        provider: 'whish',
      });
    }

    const storeRef = db.collection('storeProfiles').doc(userId);
    await storeRef.set(
      {
        pendingModularPreset: presetKey || 'custom',
        pendingModularBilling: normalizedBilling,
        pendingModularAmount: amountCents,
        pendingModularSeats: seats,
        pendingModularPosLocations: posLocs,
        pendingModularEnabledModules: moduleIds,
        pendingModularAddOnKeys: addOnKeyList,
        pendingSubscriptionPaymentId: String(externalId),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    res.json({
      success: true,
      paymentUrl: payment.data.collectUrl,
      amount: amountUsd,
      amountCents,
      pricingVersion: 'modular-v2',
      description,
    });
  } catch (error: unknown) {
    console.error('Subscribe modular error:', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

export async function activateModularSubscription(userId: string, externalId: string): Promise<void> {
  await assertNotDemoStoreProfile(db, userId);
  const storeRef = db.collection('storeProfiles').doc(userId);
  const snap = await storeRef.get();
  if (!snap.exists) throw new Error('Store not found');
  const data = snap.data() || {};

  const enabledModuleIds = Array.isArray(data.pendingModularEnabledModules)
    ? (data.pendingModularEnabledModules as string[]).filter(Boolean)
    : [];

  if (enabledModuleIds.length === 0) {
    throw new Error('No pending modular module selection');
  }

  const addOnKeys = Array.isArray(data.pendingModularAddOnKeys)
    ? (data.pendingModularAddOnKeys as string[]).filter(Boolean)
    : [];

  const presetRaw = String(data.pendingModularPreset || 'custom');
  const preset = isValidPreset(presetRaw) ? (presetRaw as StartingPackageKey) : null;

  const patch = modularActivationPatch({
    enabledModuleIds,
    addOnKeys,
    preset: preset || 'custom',
    seatCount: Number(data.pendingModularSeats) || 1,
    posLocationCount: Number(data.pendingModularPosLocations) || 0,
    billing: data.pendingModularBilling === 'yearly' ? 'yearly' : 'monthly',
    amountCents: Number(data.pendingModularAmount) || 0,
  });

  const endsAt = new Date();
  if (patch.subscriptionPlan === 'yearly') {
    endsAt.setFullYear(endsAt.getFullYear() + 1);
  } else {
    endsAt.setMonth(endsAt.getMonth() + 1);
  }

  await storeRef.set(
    {
      ...patch,
      subscriptionStatus: 'active',
      subscriptionTier: 'starter',
      subscriptionStartedAt: new Date().toISOString(),
      subscriptionEndsAt: endsAt.toISOString(),
      nextBillingDate: endsAt.toISOString(),
      lastPaymentDate: new Date().toISOString(),
      lastPaymentAmount: (Number(data.pendingModularAmount) || 0) / 100,
      billingHistory: admin.firestore.FieldValue.arrayUnion({
        date: new Date().toISOString(),
        amount: (Number(data.pendingModularAmount) || 0) / 100,
        plan: patch.subscriptionPlan,
        tier: 'modular-v2',
        status: 'success',
        transactionId: externalId,
        description: `Modular ${presetRaw} - ${patch.subscriptionPlan}`,
      }),
      pendingModularPreset: admin.firestore.FieldValue.delete(),
      pendingModularBilling: admin.firestore.FieldValue.delete(),
      pendingModularAmount: admin.firestore.FieldValue.delete(),
      pendingModularSeats: admin.firestore.FieldValue.delete(),
      pendingModularPosLocations: admin.firestore.FieldValue.delete(),
      pendingModularEnabledModules: admin.firestore.FieldValue.delete(),
      pendingModularAddOnKeys: admin.firestore.FieldValue.delete(),
      pendingSubscriptionPaymentId: admin.firestore.FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

/**
 * Schedule legacy → modular migration at next renewal (no immediate price change).
 */
export async function scheduleRenewalMigration(req: Request, res: Response) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const storeRef = db.collection('storeProfiles').doc(userId);
    const snap = await storeRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Store not found' });

    const data = snap.data() || {};
    const renewalAt = data.subscriptionEndsAt
      ? new Date(String(data.subscriptionEndsAt))
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const patch = buildRenewalMigrationPatch(data, renewalAt.toISOString());

    await storeRef.set(patch, { merge: true });
    res.json({ success: true, scheduledPlanMigrationAt: patch.scheduledPlanMigrationAt });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
}
