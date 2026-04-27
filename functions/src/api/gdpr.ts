import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

type AuthContext = {
  uid: string;
  storeId: string;
};

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function resolveAuthContext(req: Request): Promise<AuthContext> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('Missing bearer token');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const requestedStoreId = String(req.body?.storeId || '').trim();
  const storeId = requestedStoreId || decoded.uid;

  if (decoded.uid !== storeId) {
    throw new Error('Unauthorized store access');
  }

  return {
    uid: decoded.uid,
    storeId,
  };
}

async function fetchCollectionByStoreId(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  storeId: string,
  limit = 500,
): Promise<Array<Record<string, unknown>>> {
  const snap = await db
    .collection(collectionName)
    .where('storeId', '==', storeId)
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function exportGdprData(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveAuthContext(req);
    const db = admin.firestore();

    const storeProfileSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!storeProfileSnap.exists) {
      res.status(404).json({ success: false, message: 'Store profile not found' });
      return;
    }

    const [products, orders, customers, subscribers] = await Promise.all([
      fetchCollectionByStoreId(db, 'products', storeId),
      fetchCollectionByStoreId(db, 'orders', storeId),
      fetchCollectionByStoreId(db, 'customers', storeId),
      fetchCollectionByStoreId(db, 'marketingSubscribers', storeId),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      storeId,
      storeProfile: { id: storeProfileSnap.id, ...storeProfileSnap.data() },
      products,
      orders,
      customers,
      marketingSubscribers: subscribers,
      summary: {
        products: products.length,
        orders: orders.length,
        customers: customers.length,
        marketingSubscribers: subscribers.length,
      },
    };

    await db.collection('gdprRequests').add({
      storeId,
      type: 'export',
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      summary: payload.summary,
    });

    res.json({ success: true, data: payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export GDPR data';
    const status = message.includes('Unauthorized') ? 403 : message.includes('Missing bearer token') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}

export async function requestGdprDelete(req: Request, res: Response): Promise<void> {
  try {
    const { storeId } = await resolveAuthContext(req);
    const confirmDelete = Boolean(req.body?.confirmDelete);

    if (!confirmDelete) {
      res.status(400).json({ success: false, message: 'confirmDelete=true is required' });
      return;
    }

    const db = admin.firestore();
    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      res.status(404).json({ success: false, message: 'Store profile not found' });
      return;
    }

    await Promise.all([
      db.collection('gdprRequests').add({
        storeId,
        type: 'delete',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      storeRef.update({
        gdprDeletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
        gdprDeletionStatus: 'pending',
      }),
    ]);

    res.json({
      success: true,
      message: 'GDPR deletion request submitted and marked as pending.',
      status: 'pending',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to request GDPR deletion';
    const status = message.includes('Unauthorized') ? 403 : message.includes('Missing bearer token') ? 401 : 500;
    res.status(status).json({ success: false, message });
  }
}
