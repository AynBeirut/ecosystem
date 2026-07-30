import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { canUseModule } from '../lib/entitlements';
import {
  calculateAvailableStock,
  normalizeIngredientId,
  recipeIngredients,
  StockRawMaterial,
  StockRecipe,
} from '../lib/composedProductStock';
import {
  glPostExpensePaid,
  glPostOrderSaleReversal,
  glPostPayrollPayment,
  glPostPurchaseReceived,
} from '../lib/ledger/platformGlBridge';
import { resolveOrderCogsLines } from '../lib/ledger/resolveOrderCogs';
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

type PosOrderCustomerInput = {
  customerId?: unknown;
  customer_id?: unknown;
  customerLocalId?: unknown;
  localCustomerId?: unknown;
  clientId?: unknown;
  client_id?: unknown;
  customerName?: unknown;
  customer_name?: unknown;
  clientName?: unknown;
  customerPhone?: unknown;
  customer_phone?: unknown;
  phone?: unknown;
  customerEmail?: unknown;
  customer_email?: unknown;
  email?: unknown;
  customer?: Record<string, unknown>;
  client?: Record<string, unknown>;
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
): Array<{ rawMaterialId: string; materialId: string; name: string; quantity: number; unit: string }> {
  return recipeIngredients(recipe).map((ingredient) => {
    const rawMaterialId = normalizeIngredientId(ingredient);
    const material = rawMaterialsById.get(rawMaterialId) || {};
    return {
      rawMaterialId,
      materialId: rawMaterialId,
      name: String(material.name || material.materialName || '').trim(),
      quantity: Number(ingredient.quantity || 0),
      unit: String(material.unit || '').trim(),
    };
  });
}

function normalizeIsoTimestamp(value: unknown): string {
  const raw = String(value || '').trim();
  return raw || new Date().toISOString();
}

function normalizeOptionalString(value: unknown): string {
  return String(value || '').trim();
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) return normalized;
  }
  return '';
}

async function markGlPostingPosted(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  await ref.set(
    {
      glPostingStatus: 'posted',
      glPostedAt: admin.firestore.FieldValue.serverTimestamp(),
      glPostingError: admin.firestore.FieldValue.delete(),
    },
    { merge: true },
  );
}

async function markGlPostingFailed(
  ref: FirebaseFirestore.DocumentReference,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await ref.set(
    {
      glPostingStatus: 'failed',
      glPostingFailedAt: admin.firestore.FieldValue.serverTimestamp(),
      glPostingError: message,
    },
    { merge: true },
  );
}

async function findPosOrderBySaleId(
  storeId: string,
  saleId: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const trimmedSaleId = String(saleId || '').trim();
  if (!trimmedSaleId) return null;

  const localSaleSnap = await db.collection('orders').where('localSaleId', '==', trimmedSaleId).limit(10).get();
  const localMatch = localSaleSnap.docs.find(
    (doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data()?.storeId === storeId,
  );
  if (localMatch) {
    return { id: localMatch.id, data: localMatch.data() as Record<string, unknown> };
  }

  const legacySaleSnap = await db.collection('orders').where('posSaleId', '==', trimmedSaleId).limit(10).get();
  const legacyMatch = legacySaleSnap.docs.find(
    (doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data()?.storeId === storeId,
  );
  if (legacyMatch) {
    return { id: legacyMatch.id, data: legacyMatch.data() as Record<string, unknown> };
  }

  return null;
}

function extractOrderCustomerInput(body: Record<string, unknown>): {
  customerLocalId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
} {
  const customerObj =
    body.customer && typeof body.customer === 'object' ? (body.customer as Record<string, unknown>) : {};
  const clientObj =
    body.client && typeof body.client === 'object' ? (body.client as Record<string, unknown>) : {};

  return {
    customerLocalId: firstNonEmptyString(
      body.customerId,
      body.customer_id,
      body.customerLocalId,
      body.localCustomerId,
      body.clientId,
      body.client_id,
      customerObj.customerId,
      customerObj.id,
      customerObj.localId,
      clientObj.customerId,
      clientObj.id,
      clientObj.localId,
    ),
    customerName: firstNonEmptyString(
      body.customerName,
      body.customer_name,
      body.clientName,
      customerObj.name,
      customerObj.customerName,
      clientObj.name,
      clientObj.customerName,
    ),
    customerPhone: firstNonEmptyString(
      body.customerPhone,
      body.customer_phone,
      body.phone,
      customerObj.phone,
      customerObj.customerPhone,
      clientObj.phone,
      clientObj.customerPhone,
    ),
    customerEmail: firstNonEmptyString(
      body.customerEmail,
      body.customer_email,
      body.email,
      customerObj.email,
      customerObj.customerEmail,
      clientObj.email,
      clientObj.customerEmail,
    ),
  };
}

async function lookupCustomerByField(
  field: 'phone' | 'email' | 'name',
  value: string,
  storeId: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  if (!value) return null;
  const snap = await db.collection('customers').where(field, '==', value).limit(10).get();
  const match = snap.docs.find(
    (doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data()?.storeId === storeId,
  );
  if (!match) return null;
  return { id: match.id, data: match.data() as Record<string, unknown> };
}

async function resolveOrderCustomer(
  storeId: string,
  raw: {
    customerLocalId: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
  },
): Promise<{
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}> {
  const docCandidates = Array.from(
    new Set(
      [raw.customerLocalId]
        .filter(Boolean)
        .flatMap((id) =>
          id.startsWith(`pos-${storeId}-`) ? [id] : [`pos-${storeId}-${id}`, id],
        ),
    ),
  );

  for (const docId of docCandidates) {
    const snap = await db.collection('customers').doc(docId).get();
    if (snap.exists && snap.data()?.storeId === storeId) {
      const data = snap.data() as Record<string, unknown>;
      return {
        customerId: snap.id,
        customerName: firstNonEmptyString(raw.customerName, data.name, data.customerName, 'Walk-in Customer'),
        customerPhone: firstNonEmptyString(raw.customerPhone, data.phone, data.customerPhone),
        customerEmail: firstNonEmptyString(raw.customerEmail, data.email, data.customerEmail),
      };
    }
  }

  const fieldMatch =
    (await lookupCustomerByField('email', raw.customerEmail, storeId)) ||
    (await lookupCustomerByField('phone', raw.customerPhone, storeId)) ||
    (await lookupCustomerByField('name', raw.customerName, storeId));

  if (fieldMatch) {
    return {
      customerId: fieldMatch.id,
      customerName: firstNonEmptyString(raw.customerName, fieldMatch.data.name, 'Walk-in Customer'),
      customerPhone: firstNonEmptyString(raw.customerPhone, fieldMatch.data.phone),
      customerEmail: firstNonEmptyString(raw.customerEmail, fieldMatch.data.email),
    };
  }

  const customerName =
    raw.customerName ||
    raw.customerPhone ||
    raw.customerEmail ||
    'Walk-in Customer';

  return {
    customerName,
    customerPhone: raw.customerPhone,
    customerEmail: raw.customerEmail,
  };
}

async function resolvePosOrderProductIds(
  storeId: string,
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    unitPrice: number;
    total: number;
  }>,
): Promise<Array<Record<string, unknown>>> {
  const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
  const byAnyId = new Map<string, string>();

  productsSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data() as Record<string, unknown>;
    byAnyId.set(doc.id, doc.id);
    const localId = String(data.localId || '').trim();
    if (localId) {
      byAnyId.set(localId, doc.id);
      byAnyId.set(`pos-${storeId}-${localId}`, doc.id);
    }
  });

  return items.map((item) => {
    const rawProductId = String(item.productId || '').trim();
    const resolvedProductId = byAnyId.get(rawProductId) || rawProductId;
    return {
      ...item,
      productId: resolvedProductId,
      ...(resolvedProductId !== rawProductId ? { posProductLocalId: rawProductId } : {}),
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
    const body = (req.body || {}) as Record<string, unknown>;
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
    } = body as {
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

    const resolvedItems = await resolvePosOrderProductIds(
      authResult.auth.storeId,
      normalizedItems,
    );

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

    const resolvedCustomer = await resolveOrderCustomer(
      authResult.auth.storeId,
      extractOrderCustomerInput(body),
    );

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
        ...(resolvedCustomer.customerId ? { customerId: resolvedCustomer.customerId } : {}),
        customerName: resolvedCustomer.customerName,
        ...(resolvedCustomer.customerPhone ? { customerPhone: resolvedCustomer.customerPhone } : {}),
        ...(resolvedCustomer.customerEmail ? { customerEmail: resolvedCustomer.customerEmail } : {}),
        items: resolvedItems,
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
    const stagedPurchases: Array<{
      ref: FirebaseFirestore.DocumentReference;
      docId: string;
      date: string;
      supplierName: string;
      items: Record<string, unknown>[];
      totalAmount: number;
      totalCost: number;
      subtotal: number;
      taxAmount: number;
      taxType: string;
      taxRate: number;
      status: string;
    }> = [];
    let count = 0;
    for (const p of purchases) {
      const localId = String(p.id || '').trim();
      if (!localId) continue;
      const docId = `pos-${authResult.auth.storeId}-${localId}`;
      const docRef = db.collection('purchases').doc(docId);
      const date = normalizeIsoTimestamp(p.date || p.delivery_date);
      const supplierName = String(p.supplierName || p.supplier_name || '').trim();
      const items = Array.isArray(p.items) ? p.items : [];
      const totalAmount = Number(p.totalAmount || p.total_amount || p.total) || 0;
      const status = String(p.status || 'received').trim();
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        supplierId: String(p.supplierId || p.supplier_id || '').trim(),
        supplierName,
        date,
        invoiceNumber: String(p.invoiceNumber || p.invoice_number || '').trim(),
        items,
        totalAmount,
        totalCost: Number(p.totalCost || p.total_cost) || totalAmount,
        subtotal: Number(p.subtotal) || 0,
        taxAmount: Number(p.taxAmount || p.tax_amount || p.vat) || 0,
        taxType: String(p.taxType || p.tax_type || '').trim(),
        taxRate: Number(p.taxRate || p.tax_rate) || 0,
        paidAmount: Number(p.paidAmount || p.paid_amount) || 0,
        status,
        notes: String(p.notes || '').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      stagedPurchases.push({
        ref: docRef,
        docId,
        date,
        supplierName,
        items,
        totalAmount,
        status,
        subtotal: Number(p.subtotal) || 0,
        taxAmount: Number(p.taxAmount || p.tax_amount || p.vat) || 0,
        taxType: String(p.taxType || p.tax_type || '').trim(),
        taxRate: Number(p.taxRate || p.tax_rate) || 0,
        totalCost: Number(p.totalCost || p.total_cost) || totalAmount,
      });
      count++;
    }
    await batch.commit();

    for (const purchase of stagedPurchases) {
      try {
        await glPostPurchaseReceived(authResult.auth.storeId, {
          id: purchase.docId,
          date: purchase.date,
          supplierName: purchase.supplierName,
          items: purchase.items as Array<Record<string, unknown>>,
          totalAmount: purchase.totalAmount,
          totalCost: purchase.totalCost,
          total: purchase.totalCost,
          subtotal: purchase.subtotal,
          taxAmount: purchase.taxAmount,
          taxType: purchase.taxType,
          taxRate: purchase.taxRate,
          status: purchase.status,
        });
        await markGlPostingPosted(purchase.ref);
      } catch (error) {
        await markGlPostingFailed(purchase.ref, error);
        throw error;
      }
    }

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
    const stagedExpenses: Array<{
      ref: FirebaseFirestore.DocumentReference;
      docId: string;
      date: string;
      category: string;
      description: string;
      amount: number;
      paymentMethod: string;
    }> = [];
    let count = 0;
    for (const e of expenses) {
      const localId = String(e.id || '').trim();
      if (!localId) continue;
      const docId = `pos-${authResult.auth.storeId}-${localId}`;
      const docRef = db.collection('expenses').doc(docId);
      const category = String(e.category || '').trim();
      const description = String(e.description || '').trim();
      const amount = Number(e.amount) || 0;
      const date = normalizeIsoTimestamp(e.date);
      const paymentMethod = String(e.paymentMethod || e.payment_method || 'cash').trim();
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        category,
        subcategory: String(e.subcategory || '').trim(),
        description,
        amount,
        date,
        paymentMethod,
        reference: String(e.reference || '').trim(),
        vendor: String(e.vendor || '').trim(),
        status: String(e.status || 'paid').trim(),
        notes: String(e.notes || '').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      stagedExpenses.push({ ref: docRef, docId, date, category, description, amount, paymentMethod });
      count++;
    }
    await batch.commit();

    for (const expense of stagedExpenses) {
      try {
        await glPostExpensePaid(authResult.auth.storeId, {
          id: expense.docId,
          date: expense.date,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          paymentMethod: expense.paymentMethod,
        });
        await markGlPostingPosted(expense.ref);
      } catch (error) {
        await markGlPostingFailed(expense.ref, error);
        throw error;
      }
    }

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
      const firstName = String(s.firstName || '').trim();
      const lastName = String(s.lastName || '').trim();
      const displayName = [firstName, lastName].filter(Boolean).join(' ').trim() || firstName || lastName;
      const docRef = db.collection('staff').doc(`pos-${authResult.auth.storeId}-${localId}`);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        firstName,
        lastName,
        name: displayName,
        staffName: displayName,
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

    const staffSnap = await db.collection('staff').where('storeId', '==', authResult.auth.storeId).get();
    const staffByLocalId = new Map<string, { staffName: string }>();
    const staffByDocId = new Map<string, { staffName: string }>();
    staffSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data() as { localId?: unknown; firstName?: unknown; lastName?: unknown; name?: unknown; staffName?: unknown };
      const firstName = String(data.firstName || '').trim();
      const lastName = String(data.lastName || '').trim();
      const displayName =
        String(data.staffName || '').trim() ||
        String(data.name || '').trim() ||
        [firstName, lastName].filter(Boolean).join(' ').trim();
      const localId = String(data.localId || '').trim();
      if (displayName) {
        if (localId) staffByLocalId.set(localId, { staffName: displayName });
        staffByDocId.set(doc.id, { staffName: displayName });
      }
    });

    const batch = db.batch();
    const stagedSalaries: Array<{
      ref: FirebaseFirestore.DocumentReference;
      docId: string;
      netAmount: number;
      paymentDate: string;
      paymentMethod: string;
    }> = [];
    let count = 0;
    for (const s of salaries) {
      const localId = String(s.id || '').trim();
      if (!localId) continue;
      const docId = `pos-${authResult.auth.storeId}-${localId}`;
      const docRef = db.collection('salaryPayments').doc(docId);
      const staffId = String(s.staffId || '').trim();
      const netAmount = Number(s.netAmount) || 0;
      const amount = netAmount;
      const paymentMethod = String(s.paymentMethod || 'cash').trim();
      const paymentDate = normalizeIsoTimestamp(s.paymentDate);
      const resolvedStaffName =
        String(s.staffName || s.employeeName || s.name || '').trim() ||
        staffByLocalId.get(staffId)?.staffName ||
        staffByDocId.get(staffId)?.staffName ||
        '';
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        staffId,
        staffName: resolvedStaffName,
        paymentType: String(s.paymentType || '').trim(),
        paymentPeriod: String(s.paymentPeriod || '').trim(),
        baseAmount: Number(s.baseAmount) || 0,
        overtimeAmount: Number(s.overtimeAmount) || 0,
        bonusAmount: Number(s.bonusAmount) || 0,
        deductions: Number(s.deductions) || 0,
        amount,
        netAmount,
        paymentMethod,
        paymentDate,
        status: String(s.status || 'paid').trim(),
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      stagedSalaries.push({ ref: docRef, docId, netAmount, paymentDate, paymentMethod });
      count++;
    }
    await batch.commit();

    for (const salary of stagedSalaries) {
      try {
        await glPostPayrollPayment(
          authResult.auth.storeId,
          salary.docId,
          salary.netAmount,
          salary.paymentDate,
          salary.paymentMethod,
        );
        await markGlPostingPosted(salary.ref);
      } catch (error) {
        await markGlPostingFailed(salary.ref, error);
        throw error;
      }
    }

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
      const normalizedIngredients = Array.isArray(r.ingredients)
        ? r.ingredients
            .map((ingredient: Record<string, unknown>) => {
              const rawMaterialId = String(
                ingredient.rawMaterialId || ingredient.materialId || '',
              ).trim();
              if (!rawMaterialId) return null;
              return {
                ...ingredient,
                rawMaterialId,
              };
            })
            .filter(Boolean)
        : [];
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
        ingredients: normalizedIngredients,
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
    const stagedRefunds: Array<{
      ref: FirebaseFirestore.DocumentReference;
      docId: string;
      saleId: string;
      refundAmount: number;
      refundType: string;
      refundItems: Array<Record<string, unknown>>;
      paymentMethod: string;
      timestamp: string;
    }> = [];
    let count = 0;
    for (const r of refunds) {
      const localId = String(r.id || '').trim();
      if (!localId) continue;
      const docId = `pos-${authResult.auth.storeId}-${localId}`;
      const docRef = db.collection('salesReturns').doc(docId);
      const saleId = String(r.saleId || '').trim();
      const refundAmount = Number(r.refundAmount) || 0;
      const refundType = String(r.refundType || 'full').trim();
      const refundItems = Array.isArray(r.refundItems) ? r.refundItems : [];
      const paymentMethod = String(r.paymentMethod || 'cash').trim();
      const timestamp = normalizeIsoTimestamp(r.timestamp);
      batch.set(docRef, {
        storeId: authResult.auth.storeId,
        localId,
        saleId,
        refundAmount,
        refundType,
        refundItems,
        reason: String(r.reason || '').trim(),
        approvedBy: String(r.approvedBy || '').trim(),
        processedBy: String(r.processedBy || '').trim(),
        timestamp,
        paymentMethod,
        status: 'completed',
        source: 'pos',
        posDeviceId: authResult.auth.deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      stagedRefunds.push({
        ref: docRef,
        docId,
        saleId,
        refundAmount,
        refundType,
        refundItems,
        paymentMethod,
        timestamp,
      });
      count++;
    }
    await batch.commit();

    for (const refund of stagedRefunds) {
      try {
        const order = await findPosOrderBySaleId(authResult.auth.storeId, refund.saleId);
        if (!order) {
          throw new Error(`Refund references unknown POS saleId: ${refund.saleId}`);
        }

        const orderItems = Array.isArray(order.data.items) ? order.data.items : [];
        const orderTotal = Number(order.data.total || 0);
        let cogsLines =
          refund.refundItems.length > 0
            ? await resolveOrderCogsLines(authResult.auth.storeId, refund.refundItems)
            : await resolveOrderCogsLines(authResult.auth.storeId, orderItems);

        if (
          refund.refundType.toLowerCase() !== 'full' &&
          refund.refundItems.length === 0 &&
          refund.refundAmount > 0 &&
          orderTotal > 0
        ) {
          const factor = Math.max(0, Math.min(1, refund.refundAmount / orderTotal));
          cogsLines = cogsLines.map((line) => ({
            ...line,
            quantity: line.quantity * factor,
          }));
        }

        await glPostOrderSaleReversal(
          authResult.auth.storeId,
          {
            id: order.id,
            storeId: authResult.auth.storeId,
            date: refund.timestamp,
            total: refund.refundAmount > 0 ? refund.refundAmount : orderTotal,
            paymentMethod:
              String(order.data.paymentMethod || refund.paymentMethod || 'cash').trim(),
            invoiceNumber: String(order.data.invoiceNumber || order.id).trim(),
            cogsLines,
            isCashSale: true,
          },
          refund.docId,
        );
        await markGlPostingPosted(refund.ref);
      } catch (error) {
        await markGlPostingFailed(refund.ref, error);
        throw error;
      }
    }

    res.status(200).json({ success: true, synced: count });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Refunds sync failed' });
  }
}
