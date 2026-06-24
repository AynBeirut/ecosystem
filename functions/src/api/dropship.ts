import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import {
  fetchSheinAvailability,
  isSheinProductUrl,
  normalizeSheinProductUrl,
} from '../services/sheinProductSync';

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function assertCanSyncStore(req: Request, storeId: string): Promise<{ uid: string }> {
  const token = getBearerToken(req);
  if (!token) {
    throw Object.assign(new Error('Missing authorization'), { status: 401 });
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;

  if (uid === storeId) {
    return { uid };
  }

  const db = admin.firestore();
  const userSnap = await db.collection('users').doc(uid).get();
  const subAccountId = String(userSnap.data()?.subAccountId || '').trim();
  if (!subAccountId) {
    throw Object.assign(new Error('Unauthorized for this store'), { status: 403 });
  }

  const subSnap = await db.collection('subAccounts').doc(subAccountId).get();
  if (!subSnap.exists) {
    throw Object.assign(new Error('Unauthorized for this store'), { status: 403 });
  }

  const subData = subSnap.data() || {};
  if (String(subData.storeId || '') !== storeId) {
    throw Object.assign(new Error('Unauthorized for this store'), { status: 403 });
  }

  const permissions = Array.isArray(subData.permissions) ? subData.permissions : [];
  if (!permissions.includes('manage_inventory')) {
    throw Object.assign(new Error('Missing manage_inventory permission'), { status: 403 });
  }

  return { uid };
}

/**
 * POST /dropship/sync-product
 * Body: { storeId, productId }
 */
export async function syncDropshipProduct(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.body?.storeId || '').trim();
    const productId = String(req.body?.productId || '').trim();

    if (!storeId || !productId) {
      res.status(400).json({ success: false, error: 'storeId and productId are required' });
      return;
    }

    await assertCanSyncStore(req, storeId);

    const db = admin.firestore();
    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const product = productSnap.data() || {};
    if (String(product.storeId || '') !== storeId) {
      res.status(403).json({ success: false, error: 'Product does not belong to this store' });
      return;
    }

    const supplierUrl = String(product.supplierProductUrl || '').trim();
    if (!supplierUrl) {
      res.status(400).json({
        success: false,
        error: 'No Shein link on this product. Add a link in Admin → Products first.',
      });
      return;
    }

    if (!isSheinProductUrl(supplierUrl)) {
      res.status(400).json({ success: false, error: 'Supplier link must be a shein.com product URL' });
      return;
    }

    const syncResult = await fetchSheinAvailability(supplierUrl);
    const now = new Date().toISOString();
    const normalizedUrl = normalizeSheinProductUrl(supplierUrl);

    const updatePayload: Record<string, unknown> = {
      supplierPlatform: 'shein',
      supplierProductUrl: normalizedUrl,
      supplierSyncEnabled: true,
      supplierExternalId: syncResult.externalId || product.supplierExternalId || null,
      supplierLastSyncAt: now,
      supplierLastSyncStatus: 'ok',
      supplierLastSyncMessage: syncResult.message,
      inStock: syncResult.inStock,
      stock: syncResult.stock,
      updatedAt: now,
    };

    const existingImage = String(product.image || '').trim();
    const placeholderImage = /placehold\.co/i.test(existingImage);
    if ((!existingImage || placeholderImage) && syncResult.imageUrl) {
      updatePayload.image = syncResult.imageUrl;
    }

    const existingName = String(product.name || '').trim();
    if (!existingName && syncResult.title) {
      updatePayload.name = syncResult.title.slice(0, 300);
    }

    const existingDescription = String(product.description || '').trim();
    if (!existingDescription && syncResult.description) {
      updatePayload.description = syncResult.description.slice(0, 2000);
    }

    await productRef.update(updatePayload);

    res.json({
      success: true,
      inStock: syncResult.inStock,
      stock: syncResult.stock,
      imageUpdated: Boolean((!existingImage || placeholderImage) && syncResult.imageUrl),
      titleUpdated: Boolean(!existingName && syncResult.title),
      descriptionUpdated: Boolean(!existingDescription && syncResult.description),
      message: syncResult.message,
      syncedAt: now,
    });
  } catch (error: unknown) {
    const blockedByShein =
      typeof error === 'object' &&
      error &&
      'blockedByShein' in error &&
      Boolean((error as { blockedByShein?: boolean }).blockedByShein);

    const status =
      typeof error === 'object' && error && 'status' in error
        ? Number((error as { status?: number }).status) || 500
        : blockedByShein
          ? 503
          : 500;
    const message = error instanceof Error ? error.message : 'Sync failed';

    const productId = String(req.body?.productId || '').trim();
    if (productId && status !== 401 && status !== 403 && status !== 404) {
      try {
        const db = admin.firestore();
        await db.collection('products').doc(productId).update({
          supplierLastSyncAt: new Date().toISOString(),
          supplierLastSyncStatus: 'error',
          supplierLastSyncMessage: message.slice(0, 500),
        });
      } catch {
        // ignore secondary write errors
      }
    }

    if (status < 500) {
      res.status(status).json({ success: false, error: message });
      return;
    }

    console.error('dropship sync error', error);
    res.status(500).json({ success: false, error: message });
  }
}
