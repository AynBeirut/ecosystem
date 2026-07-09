import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { canUseModule } from '../lib/entitlements';
import {
  calculateAvailableStock,
  recipeIngredients,
  StockRawMaterial,
  StockRecipe,
} from '../lib/composedProductStock';
import { applyPaidOrderInventoryDeduction } from '../services/orderInventory';
import { deductComposedIngredientsOnSale } from '../services/kitchenSaleDeduction';

const db = admin.firestore();

/** Root lookup so /pos/pair does not need a collection-group index on posPairingCodes.code */
const POS_PAIRING_LOOKUP = 'posPairingCodeLookup';

type ComposedProductSource = 'platform' | 'pos';

type PosDeviceAuth = {
  storeId: string;
  deviceId: string;
  composedProductSource: ComposedProductSource;
};

type PosOrderItemInput = {
  productId?: string;
  id?: string;
  name?: string;
  quantity?: number | string;
  price?: number | string;
  unitPrice?: number | string;
  total?: number | string;
};

type PosOrderTotalsInput = {
  subtotal?: number | string;
  tax?: number | string;
  taxAmount?: number | string;
  discount?: number | string;
  discountAmount?: number | string;
  total?: number | string;
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeComposedProductSource(value: unknown): ComposedProductSource {
  return value === 'pos' ? 'pos' : 'platform';
}

function resolveProductType(data: Record<string, unknown>): 'simple' | 'composed' {
  const raw = data.productType ?? data.type;
  return raw === 'composed' ? 'composed' : 'simple';
}

const ALLOWED_COMMERCE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trial',
  'grace',
  'grace_period',
]);

function assertStoreCanTransact(
  profile: Record<string, unknown> | null | undefined,
): { ok: true } | { ok: false; status: number; error: string } {
  const status = String(profile?.subscriptionStatus || '').trim();
  if (!status && profile?.isLegacyUser === true) return { ok: true };
  if (!ALLOWED_COMMERCE_SUBSCRIPTION_STATUSES.has(status)) {
    return {
      ok: false,
      status: 403,
      error:
        status === 'blocked'
          ? 'Store subscription is blocked'
          : 'Store subscription is not active',
    };
  }
  return { ok: true };
}

async function authenticatePosDevice(
  storeId: string,
  deviceId: string,
  deviceToken: string,
): Promise<{ ok: true; auth: PosDeviceAuth } | { ok: false; status: number; error: string }> {
  if (!storeId || !deviceId || !deviceToken) {
    return { ok: false, status: 400, error: 'Missing fields' };
  }

  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  const commerceCheck = assertStoreCanTransact(profile);
  if (!commerceCheck.ok) {
    return commerceCheck;
  }

  if (!canUseModule(profile, 'pos')) {
    return { ok: false, status: 403, error: 'POS module not enabled' };
  }

  const deviceRef = db.collection('stores').doc(storeId).collection('posDevices').doc(deviceId);
  const deviceSnap = await deviceRef.get();
  if (!deviceSnap.exists) {
    return { ok: false, status: 404, error: 'Device not found' };
  }

  const deviceData = deviceSnap.data() || {};
  const expected = deviceData.apiKeyHash;
  if (expected !== hashToken(deviceToken)) {
    return { ok: false, status: 401, error: 'Invalid device token' };
  }

  return {
    ok: true,
    auth: {
      storeId,
      deviceId,
      composedProductSource: normalizeComposedProductSource(deviceData.composedProductSource),
    },
  };
}

function readPosAuthFromQuery(req: Request): { storeId: string; deviceId: string; deviceToken: string } {
  return {
    storeId: String(req.query.storeId || '').trim(),
    deviceId: String(req.query.deviceId || '').trim(),
    deviceToken: String(req.query.deviceToken || '').trim(),
  };
}

function readPosAuthFromBody(req: Request): { storeId: string; deviceId: string; deviceToken: string } {
  return {
    storeId: String(req.body?.storeId || '').trim(),
    deviceId: String(req.body?.deviceId || '').trim(),
    deviceToken: String(req.body?.deviceToken || '').trim(),
  };
}

function mapRecipeIngredients(
  recipe: StockRecipe | undefined,
  rawMaterialsById: Map<string, Record<string, unknown>>,
): Array<{ materialId: string; name: string; quantity: number; unit: string }> {
  return recipeIngredients(recipe).map((ingredient) => {
    const materialId = String(ingredient.rawMaterialId || '').trim();
    const material = rawMaterialsById.get(materialId) || {};
    return {
      materialId,
      name: String(material.name || material.materialName || '').trim(),
      quantity: Number(ingredient.quantity || 0),
      unit: String(material.unit || '').trim(),
    };
  });
}

async function resolveStoreIdForOwnerUid(uid: string): Promise<string> {
  const sellerSnap = await db.collection('sellers').doc(uid).get();
  if (sellerSnap.exists) {
    const sellerStoreId = String(sellerSnap.data()?.storeId || '').trim();
    if (sellerStoreId) return sellerStoreId;
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    const active =
      String(data.activeStoreId || data.primaryStoreId || data.storeId || '').trim();
    if (active) return active;
  }

  return uid;
}

async function assertOwnerOfStore(uid: string, storeId: string): Promise<boolean> {
  if (!uid || !storeId) return false;
  if (uid === storeId) return true;

  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  if (profile?.ownerId === uid) return true;

  const resolved = await resolveStoreIdForOwnerUid(uid);
  return resolved === storeId;
}

export async function createPosPairingCode(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!bearerToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(bearerToken);
    const uid = decoded.uid;
    const requestedStoreId = String(req.body?.storeId || '').trim();
    const storeId = requestedStoreId || (await resolveStoreIdForOwnerUid(uid));

    if (!(await assertOwnerOfStore(uid, storeId))) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
    if (!canUseModule(profile, 'pos')) {
      res.status(403).json({ error: 'POS module not enabled' });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));

    const pairingPayload = {
      code,
      storeId,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await Promise.all([
      db.collection('stores').doc(storeId).collection('posPairingCodes').doc(code).set(pairingPayload),
      db.collection(POS_PAIRING_LOOKUP).doc(code).set(pairingPayload),
    ]);

    res.json({ success: true, code, expiresInSeconds: 900 });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Pairing failed' });
  }
}

export async function pairPosDevice(req: Request, res: Response): Promise<void> {
  try {
    const { code, deviceName, composedProductSource } = req.body as {
      code?: string;
      deviceName?: string;
      composedProductSource?: 'platform' | 'pos';
    };

    if (!code || !deviceName) {
      res.status(400).json({ error: 'code and deviceName required' });
      return;
    }

    const normalizedCode = String(code).replace(/\D/g, '');
    if (normalizedCode.length !== 6) {
      res.status(400).json({ error: 'Invalid pairing code' });
      return;
    }

    const lookupRef = db.collection(POS_PAIRING_LOOKUP).doc(normalizedCode);
    const lookupSnap = await lookupRef.get();
    if (!lookupSnap.exists) {
      res.status(404).json({ error: 'Invalid or expired code' });
      return;
    }

    const data = lookupSnap.data() || {};
    const expiresAt = data.expiresAt?.toDate?.() as Date | undefined;
    if (expiresAt && expiresAt < new Date()) {
      res.status(410).json({ error: 'Pairing code expired' });
      return;
    }

    const storeId = String(data.storeId || '').trim();
    if (!storeId) {
      res.status(404).json({ error: 'Invalid or expired code' });
      return;
    }
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceRef = db.collection('stores').doc(storeId).collection('posDevices').doc();

    await deviceRef.set({
      deviceName,
      platform: 'windows',
      composedProductSource: composedProductSource === 'pos' ? 'pos' : 'platform',
      pairedAt: admin.firestore.FieldValue.serverTimestamp(),
      apiKeyHash: hashToken(deviceToken),
    });

    await db.collection('storeProfiles').doc(storeId).set(
      {
        composedProductSource: composedProductSource === 'pos' ? 'pos' : 'platform',
        posLocationCount: admin.firestore.FieldValue.increment(1),
      },
      { merge: true },
    );

    await Promise.all([
      lookupRef.delete(),
      db.collection('stores').doc(storeId).collection('posPairingCodes').doc(normalizedCode).delete(),
    ]);

    res.json({
      success: true,
      deviceId: deviceRef.id,
      storeId,
      deviceToken,
      composedProductSource: composedProductSource === 'pos' ? 'pos' : 'platform',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Pair failed' });
  }
}

export async function posHeartbeat(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromBody(req);
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const deviceRef = db.collection('stores').doc(storeId).collection('posDevices').doc(deviceId);
    await deviceRef.update({ lastSyncAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Heartbeat failed' });
  }
}

export async function getPosCatalog(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken } = readPosAuthFromQuery(req);
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const composedProductSource = normalizeComposedProductSource(
      req.query.composedProductSource || authResult.auth.composedProductSource,
    );

    const [productsSnap, recipesSnap, rawMaterialsSnap] = await Promise.all([
      db.collection('products').where('storeId', '==', storeId).get(),
      db.collection('recipes').where('storeId', '==', storeId).get(),
      db.collection('rawMaterials').where('storeId', '==', storeId).get(),
    ]);

    const recipesById = new Map<string, StockRecipe>();
    recipesSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      recipesById.set(doc.id, { id: doc.id, ...(doc.data() as StockRecipe) });
    });

    const rawMaterialsById = new Map<string, Record<string, unknown>>();
    const rawMaterialsList: StockRawMaterial[] = [];
    rawMaterialsSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data() as Record<string, unknown>;
      rawMaterialsById.set(doc.id, data);
      rawMaterialsList.push({ id: doc.id, ...(data as StockRawMaterial) });
    });

    const products = productsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data() as Record<string, unknown>;
      const type = resolveProductType(data);
      const recipeId = typeof data.recipeId === 'string' ? data.recipeId : '';
      const recipe = recipeId ? recipesById.get(recipeId) : undefined;

      let stock = Number(data.stock ?? 0);
      if (!Number.isFinite(stock)) stock = 0;

      if (type === 'composed' && recipe) {
        stock = calculateAvailableStock(recipe, rawMaterialsList);
      }

      const product: Record<string, unknown> = {
        id: doc.id,
        name: String(data.name || '').trim(),
        price: Number(data.price || 0),
        category: String(data.category || '').trim(),
        barcode: String(data.barcode || data.sku || '').trim(),
        stock,
        description: String(data.description || '').trim(),
        type,
      };

      if (type === 'composed' && composedProductSource === 'platform' && recipe) {
        product.recipe = mapRecipeIngredients(recipe, rawMaterialsById);
      }

      return product;
    });

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Catalog fetch failed' });
  }
}

export async function createPosOrder(req: Request, res: Response): Promise<void> {
  try {
    const {
      storeId,
      deviceId,
      deviceToken,
      localSaleId,
      items,
      totals,
      paymentMethod,
      timestamp,
      composedProductSource: composedProductSourceInput,
    } = req.body as {
      storeId?: string;
      deviceId?: string;
      deviceToken?: string;
      localSaleId?: string;
      items?: PosOrderItemInput[];
      totals?: PosOrderTotalsInput;
      paymentMethod?: string;
      timestamp?: string;
      composedProductSource?: ComposedProductSource;
    };

    const authResult = await authenticatePosDevice(
      String(storeId || '').trim(),
      String(deviceId || '').trim(),
      String(deviceToken || '').trim(),
    );
    if (!authResult.ok) {
      res.status(authResult.status).json({ error: authResult.error });
      return;
    }

    const normalizedLocalSaleId = String(localSaleId || '').trim();
    if (!normalizedLocalSaleId) {
      res.status(400).json({ error: 'localSaleId required' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items required' });
      return;
    }

    const idempotencyRef = db
      .collection('stores')
      .doc(authResult.auth.storeId)
      .collection('posOrdersByLocalSaleId')
      .doc(normalizedLocalSaleId);
    const profileRef = db.collection('storeProfiles').doc(authResult.auth.storeId);

    const normalizedItems = items.map((item) => {
      const productId = String(item.productId || item.id || '').trim();
      const quantityRaw = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity || 0);
      const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;
      const unitPriceRaw =
        typeof item.unitPrice === 'number'
          ? item.unitPrice
          : typeof item.price === 'number'
            ? item.price
            : Number(item.unitPrice || item.price || 0);
      const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0;
      const lineTotalRaw =
        typeof item.total === 'number' ? item.total : Number(item.total || unitPrice * quantity);
      const lineTotal = Number.isFinite(lineTotalRaw) ? lineTotalRaw : unitPrice * quantity;

      return {
        productId,
        name: String(item.name || '').trim(),
        quantity,
        price: unitPrice,
        unitPrice,
        total: lineTotal,
      };
    });

    if (normalizedItems.some((item) => !item.productId || item.quantity <= 0)) {
      res.status(400).json({ error: 'Each item requires productId and quantity > 0' });
      return;
    }

    const totalsInput = totals || {};
    const subtotal = Number(totalsInput.subtotal ?? 0);
    const taxAmount = Number(totalsInput.taxAmount ?? totalsInput.tax ?? 0);
    const discountAmount = Number(totalsInput.discountAmount ?? totalsInput.discount ?? 0);
    const total = Number(totalsInput.total ?? 0);

    const composedProductSource = normalizeComposedProductSource(
      composedProductSourceInput || authResult.auth.composedProductSource,
    );

    const saleTimestamp =
      typeof timestamp === 'string' && timestamp.trim() ? timestamp.trim() : new Date().toISOString();

    const orderRef = db.collection('orders').doc();
    const writeResult = await db.runTransaction(async (tx: unknown) => {
      const transaction = tx as {
        get: (
          ref: FirebaseFirestore.DocumentReference,
        ) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
        set: (
          ref: FirebaseFirestore.DocumentReference,
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => void;
      };

      const existingIdempotency = await transaction.get(idempotencyRef);
      const profileSnap = await transaction.get(profileRef);

      if (existingIdempotency.exists) {
        const existingOrderId = String(existingIdempotency.data()?.orderId || '').trim();
        if (existingOrderId) {
          return { orderId: existingOrderId, alreadyExisted: true as const };
        }
      }

      const storeProfile = profileSnap.data() || {};
      const currency = String(storeProfile.mainCurrency || 'USD').trim();
      const prefix = 'POS';
      const lastNumber = Number(storeProfile.lastPosInvoiceNumber || storeProfile.lastInvoiceNumber || 0);
      const newNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
      const invoiceNumber = `${prefix}-${String(newNumber).padStart(3, '0')}`;

      const orderData = {
        storeId: authResult.auth.storeId,
        storeName: String(storeProfile.storeName || storeProfile.businessName || storeProfile.name || '').trim(),
        currency,
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        localSaleId: normalizedLocalSaleId,
        composedProductSource,
        invoiceNumber,
        items: normalizedItems,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        taxType: 'none',
        taxRate: 0,
        taxAmount: Number.isFinite(taxAmount) ? taxAmount : 0,
        discountType: 'fixed',
        discountValue: Number.isFinite(discountAmount) ? discountAmount : 0,
        discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
        discount: Number.isFinite(discountAmount) ? discountAmount : 0,
        total: Number.isFinite(total) ? total : 0,
        paymentMethod: String(paymentMethod || 'cash').trim(),
        paymentStatus: 'paid',
        status: 'completed',
        posSaleTimestamp: saleTimestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: saleTimestamp,
      };

      transaction.set(orderRef, orderData);
      transaction.set(idempotencyRef, {
        orderId: orderRef.id,
        localSaleId: normalizedLocalSaleId,
        storeId: authResult.auth.storeId,
        deviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(profileRef, { lastPosInvoiceNumber: newNumber }, { merge: true });

      return { orderId: orderRef.id, alreadyExisted: false as const };
    });

    if (writeResult.alreadyExisted) {
      res.status(200).json({
        success: true,
        orderId: writeResult.orderId,
        alreadyExisted: true,
      });
      return;
    }

    if (composedProductSource === 'platform') {
      try {
        await applyPaidOrderInventoryDeduction(writeResult.orderId, 'manual');
      } catch (inventoryError) {
        console.error('POS order inventory deduction failed:', inventoryError);
      }

      try {
        await deductComposedIngredientsOnSale(authResult.auth.storeId, writeResult.orderId, normalizedItems);
      } catch (kitchenError) {
        console.warn('POS kitchen recipe deduction failed:', kitchenError);
      }
    }

    res.status(200).json({
      success: true,
      orderId: writeResult.orderId,
      alreadyExisted: false,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Order sync failed' });
  }
}

// ===========================
// AUTO-PAIR: Install token based pairing
// ===========================

export async function generatePosInstallToken(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!bearerToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(bearerToken);
    const uid = decoded.uid;
    const requestedStoreId = String(req.body?.storeId || '').trim();
    const storeId = requestedStoreId || (await resolveStoreIdForOwnerUid(uid));

    if (!(await assertOwnerOfStore(uid, storeId))) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
    if (!canUseModule(profile, 'pos')) {
      res.status(403).json({ error: 'POS module not enabled for this store' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const deviceName = String(req.body?.deviceName || 'POS Terminal').trim();

    await db.collection('posInstallTokens').doc(token).set({
      storeId,
      deviceName,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
    });

    res.json({ success: true, installToken: token, deviceName });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Token generation failed' });
  }
}

export async function autoPairPosDevice(req: Request, res: Response): Promise<void> {
  try {
    const installToken = String(req.body?.installToken || '').trim();
    if (!installToken || installToken.length < 20) {
      res.status(400).json({ error: 'installToken required' });
      return;
    }

    const tokenRef = db.collection('posInstallTokens').doc(installToken);
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
      res.status(404).json({ error: 'Invalid install token' });
      return;
    }

    const tokenData = tokenSnap.data() || {};
    if (tokenData.used) {
      res.status(410).json({ error: 'Token already used' });
      return;
    }

    const storeId = String(tokenData.storeId || '').trim();
    if (!storeId) {
      res.status(400).json({ error: 'Invalid token data' });
      return;
    }

    const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
    const commerceCheck = assertStoreCanTransact(profile);
    if (!commerceCheck.ok) {
      res.status(commerceCheck.status).json({ error: commerceCheck.error });
      return;
    }

    if (!canUseModule(profile, 'pos')) {
      res.status(403).json({ error: 'POS module not enabled' });
      return;
    }

    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceName = String(tokenData.deviceName || 'POS Terminal').trim();
    const deviceRef = db.collection('stores').doc(storeId).collection('posDevices').doc();

    await deviceRef.set({
      deviceName,
      platform: 'windows',
      composedProductSource: 'platform',
      pairedAt: admin.firestore.FieldValue.serverTimestamp(),
      apiKeyHash: hashToken(deviceToken),
      installedViaToken: true,
    });

    await tokenRef.update({ used: true, usedAt: admin.firestore.FieldValue.serverTimestamp(), deviceId: deviceRef.id });

    await db.collection('storeProfiles').doc(storeId).set(
      { posLocationCount: admin.firestore.FieldValue.increment(1) },
      { merge: true },
    );

    res.json({
      success: true,
      storeId,
      deviceId: deviceRef.id,
      deviceToken,
      deviceName,
      composedProductSource: 'platform',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Auto-pair failed' });
  }
}

// ===========================
// BULK SYNC ENDPOINTS
// All write to ROOT collections with storeId field
// so Grabio admin dashboard can see them
// ===========================

export async function syncPosProducts(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, products } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(products) || products.length === 0) { res.status(400).json({ error: 'products array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const p of products) {
      const localId = String(p.id || p.productId || '').trim();
      if (!localId) continue;
      const docRef = db.collection('products').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        name: String(p.name || '').trim(),
        category: String(p.category || '').trim(),
        price: Number(p.price) || 0,
        costPrice: Number(p.costPrice || p.cost_price || p.cost) || 0,
        barcode: String(p.barcode || '').trim(),
        stock: Number(p.stock) || 0,
        unit: String(p.unit || 'pieces').trim(),
        description: String(p.description || '').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Products sync failed' });
  }
}

export async function syncPosCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, customers } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(customers) || customers.length === 0) { res.status(400).json({ error: 'customers array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const c of customers) {
      const localId = String(c.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('customers').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        name: String(c.name || '').trim(),
        phone: String(c.phone || '').trim(),
        email: String(c.email || '').trim(),
        address: String(c.address || '').trim(),
        notes: String(c.notes || '').trim(),
        totalPurchases: Number(c.totalPurchases || c.total_purchases) || 0,
        totalSpent: Number(c.totalSpent || c.total_spent) || 0,
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Customers sync failed' });
  }
}

export async function syncPosSuppliers(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, suppliers } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(suppliers) || suppliers.length === 0) { res.status(400).json({ error: 'suppliers array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const s of suppliers) {
      const localId = String(s.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('suppliers').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        name: String(s.name || '').trim(),
        contactPerson: String(s.contactPerson || s.company || '').trim(),
        phone: String(s.phone || '').trim(),
        email: String(s.email || '').trim(),
        address: String(s.address || '').trim(),
        paymentTerms: String(s.paymentTerms || '').trim(),
        balance: Number(s.balance) || 0,
        notes: String(s.notes || '').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Suppliers sync failed' });
  }
}

export async function syncPosPurchases(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, purchases } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(purchases) || purchases.length === 0) { res.status(400).json({ error: 'purchases array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const p of purchases) {
      const localId = String(p.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('purchases').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        supplierId: String(p.supplierId || p.supplier_id || '').trim(),
        supplierName: String(p.supplierName || p.supplier_name || '').trim(),
        date: String(p.date || p.delivery_date || '').trim(),
        invoiceNumber: String(p.invoiceNumber || p.invoice_number || '').trim(),
        items: Array.isArray(p.items) ? p.items : [],
        totalAmount: Number(p.totalAmount || p.total_amount || p.total) || 0,
        paidAmount: Number(p.paidAmount || p.paid_amount) || 0,
        status: String(p.status || 'received').trim(),
        notes: String(p.notes || '').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Purchases sync failed' });
  }
}

export async function syncPosExpenses(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, expenses } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(expenses) || expenses.length === 0) { res.status(400).json({ error: 'expenses array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const e of expenses) {
      const localId = String(e.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('expenses').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        category: String(e.category || '').trim(),
        subcategory: String(e.subcategory || '').trim(),
        description: String(e.description || '').trim(),
        amount: Number(e.amount) || 0,
        date: String(e.date || '').trim(),
        paymentMethod: String(e.paymentMethod || e.payment_method || 'cash').trim(),
        reference: String(e.reference || '').trim(),
        vendor: String(e.vendor || '').trim(),
        status: String(e.status || 'paid').trim(),
        notes: String(e.notes || '').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Expenses sync failed' });
  }
}

// ===========================
// NEW ENDPOINTS: Staff, Salaries, Raw Materials, Recipes, Refunds
// ===========================

export async function syncPosStaff(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, staff } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(staff) || staff.length === 0) { res.status(400).json({ error: 'staff array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const s of staff) {
      const localId = String(s.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('staff').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        firstName: String(s.firstName || '').trim(),
        lastName: String(s.lastName || '').trim(),
        phone: String(s.phone || '').trim(),
        email: String(s.email || '').trim(),
        position: String(s.position || '').trim(),
        department: String(s.department || '').trim(),
        employeeCode: String(s.employeeCode || '').trim(),
        employmentType: String(s.employmentType || 'full_time').trim(),
        paymentType: String(s.paymentType || 'monthly').trim(),
        monthlySalary: Number(s.monthlySalary) || 0,
        dailyRate: Number(s.dailyRate) || 0,
        hourlyRate: Number(s.hourlyRate) || 0,
        hireDate: String(s.hireDate || '').trim(),
        isActive: s.isActive !== false && s.isActive !== 0,
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Staff sync failed' });
  }
}

export async function syncPosSalaries(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, salaries } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(salaries) || salaries.length === 0) { res.status(400).json({ error: 'salaries array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const s of salaries) {
      const localId = String(s.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('salaryPayments').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        staffId: String(s.staffId || '').trim(),
        paymentType: String(s.paymentType || '').trim(),
        paymentPeriod: String(s.paymentPeriod || '').trim(),
        baseAmount: Number(s.baseAmount) || 0,
        overtimeAmount: Number(s.overtimeAmount) || 0,
        bonusAmount: Number(s.bonusAmount) || 0,
        deductions: Number(s.deductions) || 0,
        netAmount: Number(s.netAmount) || 0,
        paymentMethod: String(s.paymentMethod || 'cash').trim(),
        paymentDate: String(s.paymentDate || '').trim(),
        status: String(s.status || 'paid').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Salaries sync failed' });
  }
}

export async function syncPosRawMaterials(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, rawMaterials } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) { res.status(400).json({ error: 'rawMaterials array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const m of rawMaterials) {
      const localId = String(m.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('rawMaterials').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        name: String(m.name || '').trim(),
        code: String(m.code || '').trim(),
        category: String(m.category || '').trim(),
        unit: String(m.unit || '').trim(),
        currentStock: Number(m.currentStock) || 0,
        minStock: Number(m.minStock) || 0,
        costPerUnit: Number(m.costPerUnit) || 0,
        isActive: m.isActive !== false && m.isActive !== 0,
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Raw materials sync failed' });
  }
}

export async function syncPosRecipes(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, recipes } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(recipes) || recipes.length === 0) { res.status(400).json({ error: 'recipes array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const r of recipes) {
      const localId = String(r.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('recipes').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        productId: String(r.productId || '').trim(),
        recipeName: String(r.recipeName || r.name || '').trim(),
        stationId: String(r.stationId || '').trim(),
        servingSize: Number(r.servingSize) || 1,
        preparationTime: Number(r.preparationTime) || 0,
        instructions: String(r.instructions || '').trim(),
        costPerServing: Number(r.costPerServing) || 0,
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        isActive: r.isActive !== false && r.isActive !== 0,
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Recipes sync failed' });
  }
}

export async function syncPosRefunds(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, deviceId, deviceToken, refunds } = req.body || {};
    const authResult = await authenticatePosDevice(storeId, deviceId, deviceToken);
    if (!authResult.ok) { res.status(authResult.status).json({ error: authResult.error }); return; }
    if (!Array.isArray(refunds) || refunds.length === 0) { res.status(400).json({ error: 'refunds array required' }); return; }

    const batch = db.batch();
    let count = 0;
    for (const r of refunds) {
      const localId = String(r.id || '').trim();
      if (!localId) continue;
      const docRef = db.collection('salesReturns').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        saleId: String(r.saleId || '').trim(),
        refundAmount: Number(r.refundAmount) || 0,
        refundType: String(r.refundType || 'full').trim(),
        refundItems: Array.isArray(r.refundItems) ? r.refundItems : [],
        reason: String(r.reason || '').trim(),
        approvedBy: String(r.approvedBy || '').trim(),
        processedBy: String(r.processedBy || '').trim(),
        timestamp: String(r.timestamp || '').trim(),
        paymentMethod: String(r.paymentMethod || 'cash').trim(),
        status: 'completed',
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Refunds sync failed' });
  }
}
