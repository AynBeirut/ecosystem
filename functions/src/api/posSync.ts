import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { canUseModule } from '../lib/entitlements';
import { assertRealStoreForCommerce } from '../services/storeCommerceGuard';

const db = admin.firestore();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPosPairingCode(req: Request, res: Response): Promise<void> {
  try {
    const storeId = String(req.body?.storeId || '').trim();
    const uid = String(req.body?.uid || '').trim();
    if (!storeId || !uid || storeId !== uid) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await assertRealStoreForCommerce(db, storeId);

    const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
    if (!canUseModule(profile, 'pos')) {
      res.status(403).json({ error: 'POS module not enabled' });
      return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));

    await db.collection('stores').doc(storeId).collection('posPairingCodes').doc(code).set({
      code,
      storeId,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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

    const codeRef = db.collectionGroup('posPairingCodes').where('code', '==', code).limit(1);
    const snap = await codeRef.get();
    if (snap.empty) {
      res.status(404).json({ error: 'Invalid or expired code' });
      return;
    }

    const codeDoc = snap.docs[0];
    const data = codeDoc.data();
    const expiresAt = data.expiresAt?.toDate?.() as Date | undefined;
    if (expiresAt && expiresAt < new Date()) {
      res.status(410).json({ error: 'Pairing code expired' });
      return;
    }

    const storeId = data.storeId as string;
    await assertRealStoreForCommerce(db, storeId);

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

    await codeDoc.ref.delete();

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
    const { storeId, deviceId, deviceToken } = req.body as {
      storeId?: string;
      deviceId?: string;
      deviceToken?: string;
    };
    if (!storeId || !deviceId || !deviceToken) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    const deviceRef = db.collection('stores').doc(storeId).collection('posDevices').doc(deviceId);
    const deviceSnap = await deviceRef.get();
    if (!deviceSnap.exists) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const expected = deviceSnap.data()?.apiKeyHash;
    if (expected !== hashToken(deviceToken)) {
      res.status(401).json({ error: 'Invalid device token' });
      return;
    }

    await deviceRef.update({ lastSyncAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Heartbeat failed' });
  }
}
