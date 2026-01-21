import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import cors from 'cors';

console.log('TOP-LEVEL LOG: Cloud Function module loaded');
console.error('TOP-LEVEL ERROR: Cloud Function module loaded');
try {
  if (!admin.apps.length) admin.initializeApp();
} catch (e) {
  // ignore if already initialized
}
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

// Explicit OPTIONS handler for all routes
app.options('*', (req, res) => {
  console.log('--- OPTIONS REQUEST ---');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Headers:', req.headers);
  res.sendStatus(204);
});

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
    const rawAuth = req.get('authorization');
    const authHeader = String(rawAuth || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
      console.error('Missing auth token');
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const userId = decoded.uid;
    // Fetch user record for name/phone
    let customerName = '';
    let customerPhone = '';
    try {
      const userRecord = await admin.auth().getUser(userId);
      customerName = userRecord.displayName || userRecord.email || '';
      customerPhone = userRecord.phoneNumber || '';
    } catch (e) {
      console.error('Failed to fetch user record', e);
    }
    console.log('User:', { userId, customerName, customerPhone });

    const body = req.body as { items?: unknown[] } | undefined;
    const { items } = body || {};
    if (!Array.isArray(items) || items.length === 0) {
      console.error('No items in request');
      return res.status(400).json({ error: 'No items' });
    }
    console.log('Checkout items:', items);

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
      const userRef = db.doc(`users/${userId}`);

      for (const storeId of Object.keys(itemsByStore)) {
        const itemsForStore = itemsByStore[storeId];
        let storeSubtotal = 0;
        const orderItems: Array<{ productId: string; price: number; quantity: number }> = [];

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
          if (typeof pData.stock === 'number' && pData.stock < qty) {
            console.error('Insufficient stock for product:', it.productId);
            throw new Error(`Insufficient stock for product: ${it.productId}`);
          }
          orderItems.push({ productId: it.productId, price: serverPrice, quantity: qty });
          storeSubtotal += serverPrice * qty;
        }
        // Log order creation attempt
        console.log('Attempting to create order for store:', storeId, 'with items:', orderItems);

        const profileRef = db.doc(`storeProfiles/${storeId}`);
        const profileSnap = await tx.get(profileRef);
        const storeProfile = profileSnap.exists ? (profileSnap.data() as StoreProfile) : undefined;

        const totalAfterDiscount = storeSubtotal;

        const orderRef = db.collection('orders').doc();
        tx.set(orderRef, {
          storeId,
          customerId: userId,
          customerName,
          customerPhone,
          items: orderItems,
          subtotal: storeSubtotal,
          discount: 0,
          total: totalAfterDiscount,
          status: 'pending',
          createdAt: getServerTimestamp(),
        });
        orderIds.push(orderRef.id);
        ordersCreated++;
        console.log('Order created:', {
          orderId: orderRef.id,
          storeId,
          customerId: userId,
          customerName,
          customerPhone,
          items: orderItems,
          subtotal: storeSubtotal,
          total: totalAfterDiscount,
          status: 'pending',
        });

        for (const it of itemsForStore) {
          const productRef = db.doc(`products/${it.productId}`);
          const prodSnap = await tx.get(productRef);
          const pData = prodSnap.exists ? (prodSnap.data() as Record<string, unknown>) : {};
          const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
          if (typeof pData.stock === 'number') {
            const newStock = (pData.stock as number) - qty;
            tx.update(productRef, { stock: newStock });
          }
        }
      }
    });

    console.log('Orders created:', orderIds);
    return res.json({ ok: true, ordersCreated, orderIds });
  } catch (err) {
    console.error('Checkout failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
  }
});

export const api = functions.https.onRequest(app);
