import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';
import { verifyPosDevice } from '../services/posDeviceAuth';
import { assertRealStoreForCommerce } from '../services/storeCommerceGuard';

const db = admin.firestore();

export async function getPosCatalog(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.query.storeId || '').trim();
    const deviceId = String(req.query.deviceId || '').trim();
    const deviceToken = String(req.query.deviceToken || '').trim();

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

    const composedProductSource =
      auth.deviceData.composedProductSource === 'pos' ? 'pos' : 'platform';

    const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();
    const products = productsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        price: data.price,
        productType: data.productType,
        stock: data.stock,
        inStock: data.inStock,
        recipeId: data.recipeId,
        category: data.category,
        costPrice: data.costPrice,
      };
    });

    let recipes: Array<Record<string, unknown>> = [];
    let rawMaterials: Array<Record<string, unknown>> = [];

    if (composedProductSource === 'platform') {
      const [recipesSnap, rawMaterialsSnap] = await Promise.all([
        db.collection('recipes').where('storeId', '==', storeId).get(),
        db.collection('rawMaterials').where('storeId', '==', storeId).get(),
      ]);
      recipes = recipesSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      }));
      rawMaterials = rawMaterialsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    await db
      .collection('stores')
      .doc(storeId)
      .collection('posDevices')
      .doc(deviceId)
      .update({ lastSyncAt: admin.firestore.FieldValue.serverTimestamp() });

    res.json({
      success: true,
      storeId,
      composedProductSource,
      products,
      recipes,
      rawMaterials,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Catalog failed' });
  }
}
