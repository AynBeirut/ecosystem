import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import cors from 'cors';
import dotenv from 'dotenv';

// Initialize Firebase Admin first
console.log('TOP-LEVEL LOG: Cloud Function module loaded');
console.error('TOP-LEVEL ERROR: Cloud Function module loaded');
try {
  if (!admin.apps.length) admin.initializeApp();
} catch (e) {
  // ignore if already initialized
}

// Load environment variables (only for local development)
if (process.env.NODE_ENV !== 'production') {
  try {
    dotenv.config();
  } catch (e) {
    // dotenv not available or failed to load
  }
}

// Import subscription and webhook handlers
import { startTrial, subscribe, subscribeStripe, cancelSubscription, getSubscriptionInfo } from './api/subscription';
import { handleWhishWebhook } from './api/webhooks';
import { processCheckout, handleCheckoutCallback } from './api/checkout';
import { createStripeCheckoutSession, confirmStripeCheckoutSession, handleStripeWebhook } from './api/stripeCheckout';
import { sendContactEmail } from './api/contact';
import { registerCustomDomain } from './api/domain';
import { connectFacebookShop, connectInstagramShopping, createMetaAdsCampaign, getMetaCatalogFeed, syncMetaCatalog, trackMetaConversionEvent } from './api/metaCatalog';
import { getRobotsTxt, getSitemap, submitSitemap } from './api/sitemap';
import { subscribeToStore, unsubscribeFromStore, listSubscribers, sendCampaign, listCampaigns } from './api/marketing';
import { dispatchOrderNotifications, retryOrderNotification } from './services/orderNotifications';
import {
  createSupplierReturn,
  updateSupplierReturnStatus,
  shipSupplierReturn,
  creditSupplierReturn,
  getSupplierReturnAnalytics,
} from './api/supplierReturns';
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json());
// Global request logger
app.use((req, res, next) => {
  console.log('--- GLOBAL REQUEST LOG ---');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  console.error('--- GLOBAL REQUEST ERROR LOG ---');
  console.error('Method:', req.method);
  console.error('Path:', req.path);
  console.error('Headers:', req.headers);
  next();
});
// Add a test GET endpoint for log visibility
app.get('/logtest', (req, res) => {
  console.log('LOGTEST endpoint hit');
  console.error('LOGTEST endpoint hit (error)');
  res.json({ ok: true, message: 'Log test endpoint hit' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Grabio API is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/checkout',
      '/payment/checkout',
      '/payment/stripe/checkout',
      '/payment/stripe/confirm',
      '/webhook/stripe',
      '/payment/callback',
      '/subscription/trial',
      '/subscription/subscribe',
      '/subscription/cancel',
      '/subscription/info',
      '/webhook/whish',
      '/supplier-returns/create',
      '/supplier-returns/update-status',
      '/supplier-returns/ship',
      '/supplier-returns/credit',
      '/supplier-returns/analytics'
    ]
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Grabio API',
    version: '2.0.0',
    status: 'operational',
    features: ['Guest Checkout', 'Payment Processing', 'Subscriptions'],
    docs: 'https://grabio.space'
  });
});

// Subscription management endpoints
app.post('/subscription/trial', startTrial);
app.post('/subscription/subscribe', subscribe);
app.post('/subscription/subscribe-stripe', subscribeStripe);
app.post('/subscription/cancel', cancelSubscription);
app.get('/subscription/info', getSubscriptionInfo);

// Webhook endpoint for Whish payment gateway
app.post('/webhook/whish', handleWhishWebhook);

// Checkout payment endpoints (using store owner's Whish Money account)
app.post('/payment/checkout', processCheckout);
app.post('/payment/stripe/checkout', createStripeCheckoutSession);
app.post('/payment/stripe/confirm', confirmStripeCheckoutSession);
app.get('/payment/callback', handleCheckoutCallback);

// Contact Us email endpoint
app.post('/contact/send', sendContactEmail);

// Custom domain management
app.post('/domain/register', registerCustomDomain);

// Sitemap for SEO
app.get('/sitemap.xml', getSitemap);
app.get('/robots.txt', getRobotsTxt);
app.post('/seo/sitemap/submit', submitSitemap);

// Meta catalog sync
app.get('/meta/catalog/feed', getMetaCatalogFeed);
app.post('/meta/catalog/sync', syncMetaCatalog);
app.post('/meta/shop/connect', connectFacebookShop);
app.post('/meta/instagram/connect', connectInstagramShopping);
app.post('/meta/conversion/track', trackMetaConversionEvent);
app.post('/meta/ads/campaign/create', createMetaAdsCampaign);

// Email marketing
app.post('/marketing/subscribe', subscribeToStore);
app.post('/marketing/unsubscribe', unsubscribeFromStore);
app.get('/marketing/subscribers', listSubscribers);
app.post('/marketing/send-campaign', sendCampaign);
app.get('/marketing/campaigns', listCampaigns);

app.post('/notifications/order/retry', async (req: Request, res: Response) => {
  try {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: missing bearer token' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const notificationId = String(req.body?.notificationId || '').trim();
    if (!notificationId) {
      return res.status(400).json({ error: 'Missing notificationId' });
    }

    const result = await retryOrderNotification(notificationId, decoded.uid);
    if (!result.ok) {
      const status = result.error === 'Unauthorized' ? 403 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Order notification retry failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Retry failed' });
  }
});

// Supplier returns
app.post('/supplier-returns/create', createSupplierReturn);
app.put('/supplier-returns/update-status', updateSupplierReturnStatus);
app.post('/supplier-returns/ship', shipSupplierReturn);
app.post('/supplier-returns/credit', creditSupplierReturn);
app.get('/supplier-returns/analytics', getSupplierReturnAnalytics);

// helper to provide a server-timestamp fallback if FieldValue is not available in runtime
function getServerTimestamp(): FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | Date {
  try {
    const anyAdmin = admin as unknown as {
      firestore: {
        FieldValue: { serverTimestamp: () => FirebaseFirestore.FieldValue };
        Timestamp: { now: () => Date };
      };
    };
    return (
      anyAdmin.firestore.FieldValue.serverTimestamp?.() ||
      anyAdmin.firestore.Timestamp.now?.() ||
      new Date()
    );
  } catch (e) {
    return new Date();
  }
}

function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validateFinancials(subtotalRaw: number, discountAmountRaw: number, taxAmountRaw: number, totalRaw: number): { valid: true; subtotal: number; discountAmount: number; taxAmount: number; total: number } | { valid: false; message: string } {
  const subtotal = roundMoney(subtotalRaw || 0);
  const discountAmount = roundMoney(discountAmountRaw || 0);
  const taxAmount = roundMoney(taxAmountRaw || 0);
  const total = roundMoney(totalRaw || 0);

  if (![subtotal, discountAmount, taxAmount, total].every(Number.isFinite)) {
    return { valid: false, message: 'Invalid non-numeric financial values' };
  }

  if (subtotal < 0 || discountAmount < 0 || taxAmount < 0 || total < 0) {
    return { valid: false, message: 'Negative financial values are not allowed' };
  }

  const expectedTotal = roundMoney(subtotal - discountAmount + taxAmount);
  if (Math.abs(expectedTotal - total) > 0.01) {
    return {
      valid: false,
      message: `Financial totals mismatch: expected ${expectedTotal.toFixed(2)}, got ${total.toFixed(2)}`,
    };
  }

  return { valid: true, subtotal, discountAmount, taxAmount, total: expectedTotal };
}

interface CheckoutItem {
  productId: string;
  storeId: string;
  quantity?: number;
}

interface DeliveryInfo {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  coordinates?: unknown;
}

interface StoreProfile {
  usdToLbpRate?: number;
  subscriptionTier?: string;
  monthlyOperationsLimit?: number;
  operationsUsedThisMonth?: number;
  monthlyOperationsUsed?: number;
  operationsUsageMonth?: string;
  [key: string]: unknown;
}

function normalizeSubscriptionTier(rawTier: unknown): 'trial' | 'starter' | 'pro' | 'business' {
  if (typeof rawTier !== 'string') return 'starter';
  const tier = rawTier.toLowerCase();
  if (tier === 'premium') return 'starter';
  if (tier === 'trial' || tier === 'starter' || tier === 'pro' || tier === 'business') {
    return tier;
  }
  return 'starter';
}

app.post('/checkout', async (req: Request, res: Response) => {
  try {
    console.log('CHECKOUT FUNCTION TRIGGERED');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('--- /checkout called ---');
    
    const body = req.body as { items?: unknown[]; deliveryInfo?: DeliveryInfo } | undefined;
    const { items, deliveryInfo } = body || {};
    
    // Auth token is OPTIONAL (supports guest checkout)
    const rawAuth = req.get('authorization');
    const authHeader = String(rawAuth || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    
    let userId: string | null = null;
    let customerName = '';
    let customerPhone = '';
    let customerEmail = '';
    let isGuest = false;
    
    if (token) {
      // Registered user checkout
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        userId = decoded.uid;
        // Fetch user record for name/phone/email
        try {
          const userRecord = await admin.auth().getUser(userId);
          customerName = userRecord.displayName || userRecord.email || '';
          customerPhone = userRecord.phoneNumber || '';
          customerEmail = userRecord.email || '';
        } catch (e) {
          console.error('Failed to fetch user record', e);
        }
        console.log('Registered user checkout:', { userId, customerName, customerPhone, customerEmail });
      } catch (e) {
        console.error('Invalid auth token', e);
        return res.status(401).json({ error: 'Invalid auth token' });
      }
    } else {
      // Guest checkout - use deliveryInfo for customer details
      isGuest = true;
      userId = `guest_${Date.now()}`; // Generate temporary guest ID
      customerName = deliveryInfo?.name || 'Guest Customer';
      customerPhone = deliveryInfo?.phone || '';
      customerEmail = deliveryInfo?.email || '';
      
      // Validate required guest info
      if (!customerPhone) {
        return res.status(400).json({ 
          error: 'Guest checkout requires a phone number' 
        });
      }
      
      console.log('Guest checkout:', { userId, customerName, customerPhone, customerEmail });
    }
    if (!Array.isArray(items) || items.length === 0) {
      console.error('No items in request');
      return res.status(400).json({ error: 'No items' });
    }
    console.log('Checkout items:', items);
    console.log('Delivery info:', deliveryInfo);

    const checkoutItems = items.map((i) => i as CheckoutItem);
    const itemsByStore: Record<string, CheckoutItem[]> = {};
    for (const it of checkoutItems) {
      if (!it.storeId) {
        console.error('Item missing storeId:', it);
        continue;
      }
      itemsByStore[it.storeId] = itemsByStore[it.storeId] || [];
      itemsByStore[it.storeId].push(it);
    }
    console.log('Items by store:', itemsByStore);

    let ordersCreated = 0;
    const orderIds: string[] = [];

    await db.runTransaction(async (tx: unknown) => {
      const transaction = tx as {
        get: (ref: ReturnType<typeof db.doc>) => Promise<{
          exists: boolean;
          data: () => Record<string, unknown>;
        }>;
        set: (ref: ReturnType<typeof db.doc>, data: Record<string, unknown>, options?: { merge?: boolean }) => void;
        update: (ref: ReturnType<typeof db.doc>, data: Record<string, unknown>) => void;
      };
      // PHASE 1: ALL READS FIRST (Firestore requirement)
      const ordersToCreate: Array<{
        storeId: string;
        orderItems: Array<{ productId: string; price: number; quantity: number }>;
        subtotal: number;
        discountAmount: number;
        taxAmount: number;
        total: number;
        storeProfile?: StoreProfile;
        trialOperationUpdate?: {
          operationsUsageMonth: string;
          operationsUsedThisMonth: number;
          monthlyOperationsUsed: number;
          updatedAt: string;
        };
      }> = [];
      
      const stockUpdates: Array<{ productId: string; newStock: number }> = [];

      for (const storeId of Object.keys(itemsByStore)) {
        const itemsForStore = itemsByStore[storeId];
        let storeSubtotal = 0;
        const orderItems: Array<{ productId: string; price: number; quantity: number }> = [];

        // Read all products for this store
        for (const it of itemsForStore) {
          if (!it.productId) {
            console.error('Invalid item, missing productId:', it);
            throw new Error('Invalid item');
          }
          const productRef = db.doc(`products/${it.productId}`);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists) {
            console.error('Product not found:', it.productId);
            throw new Error(`Product not found: ${it.productId}`);
          }
          const pData = productSnap.data() as Record<string, unknown>;
          if (pData.inStock === false) {
            console.error('Product out of stock:', it.productId);
            throw new Error(`Product out of stock: ${it.productId}`);
          }
          const serverPrice = typeof pData.price === 'number' ? pData.price : 0;
          const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
          
          // Only check stock quantity if stock tracking is enabled (stock > 0)
          // Products with stock=0 or null/undefined are made-to-order or services (no inventory tracking)
          if (typeof pData.stock === 'number' && pData.stock > 0 && pData.stock < qty) {
            console.error('Insufficient stock for product:', it.productId);
            throw new Error(`Insufficient stock for product: ${it.productId}`);
          }
          
          orderItems.push({ productId: it.productId, price: serverPrice, quantity: qty });
          storeSubtotal += serverPrice * qty;
          
          // Prepare stock update - only if stock tracking is enabled
          if (typeof pData.stock === 'number' && pData.stock > 0) {
            stockUpdates.push({ 
              productId: it.productId, 
              newStock: (pData.stock as number) - qty 
            });
          }
        }

        // Read store profile
        const profileRef = db.doc(`storeProfiles/${storeId}`);
        const profileSnap = await transaction.get(profileRef);
        const storeProfile = profileSnap.exists ? (profileSnap.data() as StoreProfile) : undefined;

        let trialOperationUpdate: {
          operationsUsageMonth: string;
          operationsUsedThisMonth: number;
          monthlyOperationsUsed: number;
          updatedAt: string;
        } | undefined;

        const tier = normalizeSubscriptionTier(storeProfile?.subscriptionTier);
        if (tier === 'trial') {
          const nowIso = new Date().toISOString();
          const monthKey = nowIso.slice(0, 7);
          const usageMonth = typeof storeProfile?.operationsUsageMonth === 'string' ? storeProfile.operationsUsageMonth : '';
          const currentUsedRaw = Number(storeProfile?.operationsUsedThisMonth ?? storeProfile?.monthlyOperationsUsed ?? 0);
          const currentUsed = usageMonth === monthKey && Number.isFinite(currentUsedRaw) ? currentUsedRaw : 0;
          const monthlyLimitRaw = Number(storeProfile?.monthlyOperationsLimit ?? 200);
          const monthlyLimit = Number.isFinite(monthlyLimitRaw) && monthlyLimitRaw > 0 ? monthlyLimitRaw : 200;
          const nextUsed = currentUsed + 1;

          if (nextUsed > monthlyLimit) {
            throw new Error(`Trial operation limit reached for store ${storeId}. Upgrade plan to continue.`);
          }

          trialOperationUpdate = {
            operationsUsageMonth: monthKey,
            operationsUsedThisMonth: nextUsed,
            monthlyOperationsUsed: nextUsed,
            updatedAt: nowIso,
          };
        }

        const discountAmount = 0;
        const taxAmount = 0;
        const totalAfterDiscount = storeSubtotal;

        const financialCheck = validateFinancials(storeSubtotal, discountAmount, taxAmount, totalAfterDiscount);
        if (!financialCheck.valid) {
          throw new Error(`Invalid order financials for store ${storeId}: ${financialCheck.message}`);
        }
        
        ordersToCreate.push({
          storeId,
          orderItems,
          subtotal: financialCheck.subtotal,
          discountAmount: financialCheck.discountAmount,
          taxAmount: financialCheck.taxAmount,
          total: financialCheck.total,
          storeProfile,
          trialOperationUpdate,
        });
        
        console.log('Prepared order for store:', storeId, 'with items:', orderItems);
      }

      // PHASE 2: ALL WRITES (after all reads are complete)
      for (const orderData of ordersToCreate) {
        // Generate online order invoice number
        const prefix = 'ON';
        const lastNumber = (orderData.storeProfile?.lastInvoiceNumber as number) || 0;
        const newNumber = lastNumber + 1;
        const invoiceNumber = `${prefix}-${String(newNumber).padStart(3, '0')}`;
        
        // Update store profile with new invoice number (use set with merge to create if not exists)
        const profileRef = db.doc(`storeProfiles/${orderData.storeId}`);
        transaction.set(
          profileRef,
          {
            lastInvoiceNumber: newNumber,
            ...(orderData.trialOperationUpdate || {}),
          },
          { merge: true }
        );
        
        const orderRef = db.collection('orders').doc();
        transaction.set(orderRef, {
          storeId: orderData.storeId,
          customerId: userId,
          customerName,
          customerPhone: deliveryInfo?.phone || customerPhone || '',
          customerEmail: deliveryInfo?.email || customerEmail || '',
          isGuest, // Flag to indicate guest checkout
          invoiceNumber,
          items: orderData.orderItems,
          subtotal: orderData.subtotal,
          taxType: 'none',
          taxRate: 0,
          taxAmount: orderData.taxAmount,
          discountType: 'fixed',
          discountValue: orderData.discountAmount,
          discountAmount: orderData.discountAmount,
          discount: orderData.discountAmount,
          total: orderData.total,
          status: 'pending',
          deliveryAddress: deliveryInfo?.address || '',
          deliveryCity: deliveryInfo?.city || '',
          deliveryNotes: deliveryInfo?.notes || '',
          deliveryCoordinates: deliveryInfo?.coordinates || null,
          createdAt: getServerTimestamp(),
        });
        orderIds.push(orderRef.id);
        ordersCreated++;
        console.log('Order created:', {
          orderId: orderRef.id,
          invoiceNumber,
          storeId: orderData.storeId,
          customerId: userId,
          customerName,
          customerPhone,
          customerEmail,
          items: orderData.orderItems,
          subtotal: orderData.subtotal,
          total: orderData.total,
          status: 'pending',
        });
      }

      // Update stock for all products
      for (const update of stockUpdates) {
        const productRef = db.doc(`products/${update.productId}`);
        transaction.update(productRef, { stock: update.newStock });
      }
    });

    console.log('Orders created:', orderIds);

    // Send FCM push notification to each store owner for their new order(s)
    // Fire-and-forget: don't block the checkout response on notification success
    (async () => {
      try {
        const storeIds = [...new Set(Object.keys(itemsByStore))];
        for (const storeId of storeIds) {
          const ownerSnap = await db.collection('users').where('storeId', '==', storeId).limit(1).get();
          if (ownerSnap.empty) continue;
          const ownerId = ownerSnap.docs[0].id;
          const fcmSnap = await db.collection('users').doc(ownerId).collection('fcmTokens').get();
          const tokens = fcmSnap.docs.map((d: any) => d.id).filter(Boolean);
          if (tokens.length === 0) continue;
          await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: '🛒 New Order Received',
              body: `${customerName || 'A customer'} just placed an order`,
            },
            data: { storeId, type: 'new_order', orderId: orderIds[0] || '' },
          });
        }
      } catch (fcmErr) {
        console.warn('FCM new-order notification failed:', fcmErr);
      }
    })();

    // Fire-and-forget customer notifications (email + optional WhatsApp webhook)
    (async () => {
      try {
        await dispatchOrderNotifications(orderIds);
      } catch (notifyErr) {
        console.warn('Order customer notification dispatch failed:', notifyErr);
      }
    })();

    return res.json({ ok: true, ordersCreated, orderIds });
  } catch (err) {
    console.error('Checkout failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
  }
});

export const api = functions.https.onRequest(
  {
    cors: true,
    region: 'us-central1',
  },
  app
);

// Export the scheduled subscription checker
export { checkSubscriptions } from './scheduled/checkSubscriptions';
// Export the scheduled expiry stock checker
export { checkExpiringStock } from './scheduled/checkExpiringStock';
// Export Firestore trigger: order status / payment status change notifications
export { onOrderStatusChanged } from './triggers/orderNotifications';
