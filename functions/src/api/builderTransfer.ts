import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { mergeBrandingIntoStoreProfile } from '../lib/builderBrandingTransfer';

const db = admin.firestore();

function generateSlug(name: string): string {
  return String(name || 'store')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'store';
}

async function resolveTargetStoreId(clientUid: string): Promise<string> {
  const legacySnap = await db.collection('storeProfiles').doc(clientUid).get();
  if (!legacySnap.exists) {
    return clientUid;
  }
  return db.collection('storeProfiles').doc().id;
}

/**
 * Admin transfer — builder hands demo to a client UID (may differ from builder UID).
 */
export async function transferBuilderDemo(req: Request, res: Response): Promise<void> {
  try {
    const authHeader = req.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const builderUid = String(req.body?.builderUid || decoded.uid).trim();
    const demoId = String(req.body?.demoId || '').trim();
    const clientUid = String(req.body?.clientUid || '').trim();

    if (!demoId || !clientUid) {
      res.status(400).json({ error: 'demoId and clientUid are required' });
      return;
    }

    if (decoded.uid !== builderUid) {
      res.status(403).json({ error: 'Only the builder owner can transfer this demo' });
      return;
    }

    const builderSnap = await db.collection('builders').doc(builderUid).get();
    if (!builderSnap.exists) {
      res.status(404).json({ error: 'Builder account not found' });
      return;
    }

    const demoRef = db.collection('builders').doc(builderUid).collection('demoStores').doc(demoId);
    const demoSnap = await demoRef.get();
    if (!demoSnap.exists) {
      res.status(404).json({ error: 'Demo store not found' });
      return;
    }

    const demo = demoSnap.data() || {};
    if (demo.status === 'converted') {
      res.status(409).json({ error: 'Demo already transferred' });
      return;
    }

    const brandingSnap = await demoRef.collection('profile').doc('branding').get();
    const branding = brandingSnap.data() || {};
    const name = String(branding.name || demo.name || 'Store').trim();
    if (!name) {
      res.status(400).json({ error: 'Demo branding is missing' });
      return;
    }

    const productsSnap = await demoRef.collection('products').get();
    const storeId = await resolveTargetStoreId(clientUid);
    const timestamp = new Date().toISOString();

    let clientEmail = '';
    try {
      const clientUser = await admin.auth().getUser(clientUid);
      clientEmail = clientUser.email || '';
    } catch {
      clientEmail = '';
    }

    const batch = db.batch();

    batch.set(db.collection('storeProfiles').doc(storeId), mergeBrandingIntoStoreProfile(branding as Record<string, unknown>, {
      id: storeId,
      storeId,
      ownerId: clientUid,
      email: clientEmail,
      name,
      slug: String(branding.slug || generateSlug(name)),
      isDemo: false,
      subscriptionStatus: 'trial',
      subscriptionTier: 'trial',
      isTrialUser: true,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      transferredFromDemoId: demoId,
      transferredFromBuilderUid: builderUid,
    }));

    const userRef = db.collection('users').doc(clientUid);
    const userSnap = await userRef.get();
    const ownedStoreIds = userSnap.exists
      ? [...new Set([...(userSnap.data()?.ownedStoreIds || []), storeId])]
      : [storeId];

    batch.set(
      userRef,
      {
        ownedStoreIds,
        primaryStoreId: userSnap.data()?.primaryStoreId || storeId,
        activeStoreId: storeId,
        role: 'admin',
        updatedAt: timestamp,
      },
      { merge: true },
    );

    batch.set(
      db.collection('sellers').doc(clientUid),
      {
        isSeller: true,
        role: 'admin',
        userId: clientUid,
        storeId,
        sellerSince: timestamp,
        updatedAt: timestamp,
      },
      { merge: true },
    );

    batch.update(demoRef, {
      status: 'converted',
      transferredStoreId: storeId,
      convertedAt: timestamp,
      updatedAt: timestamp,
    });

    await batch.commit();

    if (!productsSnap.empty) {
      const productBatch = db.batch();
      productsSnap.docs.forEach((productDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
        const p = productDoc.data();
        const productRef = db.collection('products').doc();
        productBatch.set(productRef, {
          name: p.name,
          description: p.description || '',
          price: Number(p.price) || 0,
          image: p.image || '',
          category: p.category || 'General',
          storeId,
          inStock: true,
          stock: 10,
          deliveryTime: '1-3 days',
          productType: 'simple',
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });
      await productBatch.commit();
    }

    res.json({
      success: true,
      storeId,
      productCount: productsSnap.size,
    });
  } catch (err) {
    console.error('transferBuilderDemo failed', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Transfer failed',
    });
  }
}
