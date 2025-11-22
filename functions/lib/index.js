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
const functions = __importStar(require("firebase-functions"));
const cors_1 = __importDefault(require("cors"));
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
// helper to provide a server-timestamp fallback if FieldValue is not available in runtime
function getServerTimestamp() {
    try {
        // prefer FieldValue.serverTimestamp(), otherwise Timestamp.now(), otherwise Date
        // optional chaining used to protect against undefined shapes in some runtimes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyAdmin = admin;
        return anyAdmin?.firestore?.FieldValue?.serverTimestamp?.() ?? anyAdmin?.firestore?.Timestamp?.now?.() ?? new Date();
    }
    catch (e) {
        return new Date();
    }
}
app.post('/checkout', async (req, res) => {
    try {
        const rawAuth = req.get?.('authorization');
        const authHeader = String(rawAuth || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        if (!token)
            return res.status(401).json({ error: 'Missing auth token' });
        const decoded = await admin.auth().verifyIdToken(token);
        const userId = decoded.uid;
        const body = req.body;
        const { items } = body || {};
        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ error: 'No items' });
        const checkoutItems = items.map(i => i);
        const itemsByStore = {};
        for (const it of checkoutItems) {
            if (!it.storeId)
                continue;
            itemsByStore[it.storeId] = itemsByStore[it.storeId] || [];
            itemsByStore[it.storeId].push(it);
        }
        let ordersCreated = 0;
        await db.runTransaction(async (tx) => {
            const userRef = db.doc(`users/${userId}`);
            // user credits system removed; no user data required here
            for (const storeId of Object.keys(itemsByStore)) {
                const itemsForStore = itemsByStore[storeId];
                let storeSubtotal = 0;
                const orderItems = [];
                for (const it of itemsForStore) {
                    if (!it.productId)
                        throw new Error('Invalid item');
                    const productRef = db.doc(`products/${it.productId}`);
                    const productSnap = (await tx.get(productRef));
                    if (!productSnap.exists)
                        throw new Error(`Product not found: ${it.productId}`);
                    const pData = productSnap.data();
                    if (pData.inStock === false)
                        throw new Error(`Product out of stock: ${it.productId}`);
                    const serverPrice = typeof pData.price === 'number' ? pData.price : 0;
                    const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
                    if (typeof pData.stock === 'number' && pData.stock < qty)
                        throw new Error(`Insufficient stock for product: ${it.productId}`);
                    orderItems.push({ productId: it.productId, price: serverPrice, quantity: qty });
                    storeSubtotal += serverPrice * qty;
                }
                const profileRef = db.doc(`storeProfiles/${storeId}`);
                const profileSnap = (await tx.get(profileRef));
                const storeProfile = profileSnap.exists ? profileSnap.data() : undefined;
                const totalAfterDiscount = storeSubtotal; // no credits/discounts applied
                const orderRef = db.collection('orders').doc();
                tx.set(orderRef, {
                    storeId,
                    customerId: userId,
                    items: orderItems,
                    subtotal: storeSubtotal,
                    discount: 0,
                    total: totalAfterDiscount,
                    createdAt: getServerTimestamp(),
                });
                ordersCreated++;
                for (const it of itemsForStore) {
                    const productRef = db.doc(`products/${it.productId}`);
                    const prodSnap = (await tx.get(productRef));
                    const pData = prodSnap.exists ? prodSnap.data() : {};
                    const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
                    if (typeof pData.stock === 'number') {
                        // compute explicit new stock value instead of relying on FieldValue.increment
                        const newStock = pData.stock - qty;
                        tx.update(productRef, { stock: newStock });
                    }
                }
            }
            // no user credits to update
        });
        return res.json({ ok: true, ordersCreated });
    }
    catch (err) {
        console.error('Checkout failed', err);
        // credits-related errors removed
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
});
exports.api = functions.https.onRequest(app);
