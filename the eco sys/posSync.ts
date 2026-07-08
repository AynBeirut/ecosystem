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

export async function createPosPairingCode(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.body?.storeId || '').trim();
    const uid = String(req.body?.uid || '').trim();
    if (!storeId || !uid || storeId !== uid) {
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
    const storePairingCodePath = `stores/${storeId}/posPairingCodes/${code}`;
    const pairingPayload = {
      code,
      storeId,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await Promise.all([
      db.collection('stores').doc(storeId).collection('posPairingCodes').doc(code).set(pairingPayload),
      db.collection('posPairingCodeLookup').doc(code).set({
        ...pairingPayload,
        storePairingCodePath,
      }),
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

    const lookupRef = db.collection('posPairingCodeLookup').doc(code);
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

    const cleanupDeletes: Array<Promise<FirebaseFirestore.WriteResult>> = [lookupRef.delete()];
    const storePairingCodePath = String(data.storePairingCodePath || '').trim();
    if (storePairingCodePath) {
      cleanupDeletes.push(db.doc(storePairingCodePath).delete());
    } else {
      cleanupDeletes.push(
        db.collection('stores').doc(storeId).collection('posPairingCodes').doc(code).delete(),
      );
    }
    await Promise.all(cleanupDeletes);

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
