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

async function fetchCollectionByField(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  field: string,
  value: string,
  limit = 500,
): Promise<Array<Record<string, unknown>>> {
  const snap = await db
    .collection(collectionName)
    .where(field, '==', value)
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function exportGdprData(req: Request, res: Response): Promise<void> {
  try {
    const { uid, storeId } = await resolveAuthContext(req);
    const db = admin.firestore();

    const storeProfileSnap = await db.collection('storeProfiles').doc(storeId).get();
    const userSnap = await db.collection('users').doc(uid).get();

    if (storeProfileSnap.exists) {
      const [products, orders, customers, subscribers] = await Promise.all([
        fetchCollectionByStoreId(db, 'products', storeId),
        fetchCollectionByStoreId(db, 'orders', storeId),
        fetchCollectionByStoreId(db, 'customers', storeId),
        fetchCollectionByStoreId(db, 'marketingSubscribers', storeId),
      ]);

      const payload = {
        generatedAt: new Date().toISOString(),
        actorType: 'store_owner',
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
        requestedBy: uid,
        actorType: 'store_owner',
        type: 'export',
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        summary: payload.summary,
      });

      res.json({ success: true, data: payload });
      return;
    }

    const [customerOrders, customerSubscriptions] = await Promise.all([
      fetchCollectionByField(db, 'orders', 'customerId', uid),
      fetchCollectionByField(db, 'customerSubscriptions', 'customerId', uid),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      actorType: 'customer',
      userId: uid,
      userProfile: userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : { id: uid },
      orders: customerOrders,
      subscriptions: customerSubscriptions,
      summary: {
        orders: customerOrders.length,
        subscriptions: customerSubscriptions.length,
      },
    };

    await db.collection('gdprRequests').add({
      storeId,
      requestedBy: uid,
      actorType: 'customer',
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
    const { uid, storeId } = await resolveAuthContext(req);
    const confirmDelete = Boolean(req.body?.confirmDelete);

    if (!confirmDelete) {
      res.status(400).json({ success: false, message: 'confirmDelete=true is required' });
      return;
    }

    const db = admin.firestore();
    const storeRef = db.collection('storeProfiles').doc(storeId);
    const storeSnap = await storeRef.get();

    const deleteRequestPayload: Record<string, unknown> = {
      storeId,
      requestedBy: uid,
      type: 'delete',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      actorType: storeSnap.exists ? 'store_owner' : 'customer',
    };

    const writes: Array<Promise<unknown>> = [
      db.collection('gdprRequests').add(deleteRequestPayload),
    ];

    if (storeSnap.exists) {
      writes.push(
        storeRef.update({
          gdprDeletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
          gdprDeletionStatus: 'pending',
        }),
      );
    } else {
      writes.push(
        db.collection('users').doc(uid).set({
          gdprDeletionRequestedAt: new Date().toISOString(),
          gdprDeletionStatus: 'pending',
        }, { merge: true }),
      );
    }

    await Promise.all(writes);

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
