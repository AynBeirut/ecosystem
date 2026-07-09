import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';
import { verifyPosDevice } from '../services/posDeviceAuth';
import { assertRealStoreForCommerce } from '../services/storeCommerceGuard';
import { deductComposedIngredientsOnSale } from '../services/kitchenSaleDeduction';

const db = admin.firestore();

type PosOrderLine = {
  productId?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
  productType?: string;
};

export async function pushPosOrder(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body || {}) as {
      storeId?: string;
      deviceId?: string;
      deviceToken?: string;
      saleId?: string;
      externalId?: string;
      items?: PosOrderLine[];
      total?: number;
      paymentMethod?: string;
      soldAt?: string;
    };

    const storeId = String(body.storeId || '').trim();
    const deviceId = String(body.deviceId || '').trim();
    const deviceToken = String(body.deviceToken || '').trim();

    if (!storeId || !deviceId || !deviceToken) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    const saleId = String(body.saleId || body.externalId || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!saleId || items.length === 0) {
      res.status(400).json({ error: 'saleId and items required' });
      return;
    }

    const auth = await verifyPosDevice(db, storeId, deviceId, deviceToken);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    await assertRealStoreForCommerce(db, storeId);

    const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
    if (!canUseModule(profile, 'pos')) {
      res.status(403).json({ error: 'POS module not enabled' });
      return;
    }

    const orderRef = db.collection('orders').doc();
    const composedSource =
      auth.deviceData.composedProductSource === 'pos' ? 'pos' : 'platform';

    await orderRef.set({
      storeId,
      source: 'pos',
      posDeviceId: deviceId,
      posSaleId: saleId,
      items: items.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        quantity: Number(line.quantity || 0),
        price: Number(line.unitPrice || 0),
        productType: line.productType,
      })),
      total: Number(body.total || 0),
      paymentMethod: body.paymentMethod || 'pos',
      status: 'completed',
      paymentStatus: 'paid',
      soldAt: body.soldAt || new Date().toISOString(),
      composedProductSource: composedSource,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    for (const line of items) {
      if (!line.productId || !line.quantity) continue;
      const productRef = db.collection('products').doc(line.productId);
      const productSnap = await productRef.get();
      if (!productSnap.exists) continue;
      const product = productSnap.data();
      if (product?.storeId !== storeId) continue;
      if (product?.productType === 'composed') continue;

      const currentStock = Number(product?.stock ?? 0);
      const nextStock = Math.max(0, currentStock - Number(line.quantity));
      await productRef.update({
        stock: nextStock,
        inStock: nextStock > 0,
      });
    }

    if (composedSource === 'platform') {
      await deductComposedIngredientsOnSale(storeId, orderRef.id, items);
    }

    await db
      .collection('stores')
      .doc(storeId)
      .collection('posDevices')
      .doc(deviceId)
      .update({ lastSyncAt: admin.firestore.FieldValue.serverTimestamp() });

    res.json({
      success: true,
      orderId: orderRef.id,
      storeId,
      posSaleId: saleId,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Order push failed' });
  }
}
