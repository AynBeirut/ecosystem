"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const express_1 = __importDefault(require("express"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v2"));
const cors_1 = __importDefault(require("cors"));
console.log('TOP-LEVEL LOG: Cloud Function module loaded');
console.error('TOP-LEVEL ERROR: Cloud Function module loaded');
try {
    if (!admin.apps.length)
        admin.initializeApp();
}
catch (e) {
    // ignore if already initialized
}
const db = admin.firestore();
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
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
// helper to provide a server-timestamp fallback if FieldValue is not available in runtime
function getServerTimestamp() {
    try {
        const anyAdmin = admin;
        return (anyAdmin.firestore.FieldValue.serverTimestamp?.() ||
            anyAdmin.firestore.Timestamp.now?.() ||
            new Date());
    }
    catch (e) {
        return new Date();
    }
}
app.post('/checkout', async (req, res) => {
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
        // Fetch user record for name/phone/email
        let customerName = '';
        let customerPhone = '';
        let customerEmail = '';
        try {
            const userRecord = await admin.auth().getUser(userId);
            customerName = userRecord.displayName || userRecord.email || '';
            customerPhone = userRecord.phoneNumber || '';
            customerEmail = userRecord.email || '';
        }
        catch (e) {
            console.error('Failed to fetch user record', e);
        }
        console.log('User:', { userId, customerName, customerPhone, customerEmail });
        const body = req.body;
        const { items, deliveryInfo } = body || {};
        if (!Array.isArray(items) || items.length === 0) {
            console.error('No items in request');
            return res.status(400).json({ error: 'No items' });
        }
        console.log('Checkout items:', items);
        console.log('Delivery info:', deliveryInfo);
        const checkoutItems = items.map((i) => i);
        const itemsByStore = {};
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
        let orderIds = [];
        await db.runTransaction(async (tx) => {
            // PHASE 1: ALL READS FIRST (Firestore requirement)
            const ordersToCreate = [];
            const stockUpdates = [];
            for (const storeId of Object.keys(itemsByStore)) {
                const itemsForStore = itemsByStore[storeId];
                let storeSubtotal = 0;
                const orderItems = [];
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
                    const pData = productSnap.data();
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
                    // Prepare stock update
                    if (typeof pData.stock === 'number') {
                        stockUpdates.push({
                            productId: it.productId,
                            newStock: pData.stock - qty
                        });
                    }
                }
                // Read store profile
                const profileRef = db.doc(`storeProfiles/${storeId}`);
                const profileSnap = await tx.get(profileRef);
                const storeProfile = profileSnap.exists ? profileSnap.data() : undefined;
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
                const lastNumber = orderData.storeProfile?.lastInvoiceNumber || 0;
                const newNumber = lastNumber + 1;
                const invoiceNumber = `${prefix}-${String(newNumber).padStart(3, '0')}`;
                // Update store profile with new invoice number
                const profileRef = db.doc(`storeProfiles/${orderData.storeId}`);
                tx.update(profileRef, { lastInvoiceNumber: newNumber });
                const orderRef = db.collection('orders').doc();
                tx.set(orderRef, {
                    storeId: orderData.storeId,
                    customerId: userId,
                    customerName,
                    customerPhone: deliveryInfo?.phone || customerPhone || '',
                    customerEmail: deliveryInfo?.email || customerEmail || '',
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
    }
    catch (err) {
        console.error('Checkout failed', err);
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
});
exports.api = functions.https.onRequest({
    cors: true,
    region: 'us-central1',
}, app);
