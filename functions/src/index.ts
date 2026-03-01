import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import cors from 'cors';

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
    require('dotenv').config();
  } catch (e) {
    // dotenv not available or failed to load
  }
}

// Import subscription and webhook handlers
import { startTrial, subscribe, cancelSubscription, getSubscriptionInfo } from './api/subscription';
import { handleWhishWebhook } from './api/webhooks';
import { processCheckout, handleCheckoutCallback } from './api/checkout';
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
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
      '/payment/callback',
      '/subscription/trial',
      '/subscription/subscribe',
      '/subscription/cancel',
      '/subscription/info',
      '/webhook/whish'
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
app.post('/subscription/cancel', cancelSubscription);
app.get('/subscription/info', getSubscriptionInfo);

// Webhook endpoint for Whish payment gateway
app.post('/webhook/whish', handleWhishWebhook);

// Checkout payment endpoints (using store owner's Whish Money account)
app.post('/payment/checkout', processCheckout);
app.get('/payment/callback', handleCheckoutCallback);

// helper to provide a server-timestamp fallback if FieldValue is not available in runtime
function getServerTimestamp(): Date | any {
  try {
    const anyAdmin = admin as unknown as {
      firestore: {
        FieldValue: { serverTimestamp: () => any };
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

interface CheckoutItem {
  productId: string;
  storeId: string;
  quantity?: number;
}

interface StoreProfile {
  usdToLbpRate?: number;
  [key: string]: unknown;
}

app.post('/checkout', async (req: Request, res: Response) => {
  try {
    console.log('CHECKOUT FUNCTION TRIGGERED');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('--- /checkout called ---');
    
    const body = req.body as { items?: unknown[]; deliveryInfo?: any } | undefined;
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
      if (!customerEmail || !customerPhone) {
        return res.status(400).json({ 
          error: 'Guest checkout requires email and phone number' 
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
    let orderIds: string[] = [];

    await db.runTransaction(async (tx: any) => {
      // PHASE 1: ALL READS FIRST (Firestore requirement)
      const ordersToCreate: Array<{
        storeId: string;
        orderItems: Array<{ productId: string; price: number; quantity: number }>;
        subtotal: number;
        total: number;
        storeProfile?: StoreProfile;
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
          const productSnap = await tx.get(productRef);
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
        const profileSnap = await tx.get(profileRef);
        const storeProfile = profileSnap.exists ? (profileSnap.data() as StoreProfile) : undefined;

        const totalAfterDiscount = storeSubtotal;
        
        ordersToCreate.push({
          storeId,
          orderItems,
          subtotal: storeSubtotal,
          total: totalAfterDiscount,
          storeProfile,
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
        tx.set(profileRef, { lastInvoiceNumber: newNumber }, { merge: true });
        
        const orderRef = db.collection('orders').doc();
        tx.set(orderRef, {
          storeId: orderData.storeId,
          customerId: userId,
          customerName,
          customerPhone: deliveryInfo?.phone || customerPhone || '',
          customerEmail: deliveryInfo?.email || customerEmail || '',
          isGuest, // Flag to indicate guest checkout
          invoiceNumber,
          items: orderData.orderItems,
          subtotal: orderData.subtotal,
          discount: 0,
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
        tx.update(productRef, { stock: update.newStock });
      }
    });

    console.log('Orders created:', orderIds);
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
