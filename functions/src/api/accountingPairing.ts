import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

/** Root lookup so /accounting/pair does not need a collection-group index. */
const ACCOUNTING_PAIRING_LOOKUP = 'accountingPairingCodeLookup';

const ACCOUNTING_PAIRING_TTL_SECONDS = 365 * 24 * 60 * 60;

async function resolveStoreIdForOwnerUid(uid: string): Promise<string> {
  const userSnap = await db.collection('users').doc(uid).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    const active =
      (typeof data.activeStoreId === 'string' && data.activeStoreId.trim()) ||
      (typeof data.storeId === 'string' && data.storeId.trim()) ||
      '';
    if (active) return active;
  }
  const sellerSnap = await db.collection('sellers').doc(uid).get();
  if (sellerSnap.exists) {
    const storeId = sellerSnap.data()?.storeId;
    if (typeof storeId === 'string' && storeId.trim()) return storeId.trim();
  }
  return uid;
}

async function assertOwnerOfStore(uid: string, storeId: string): Promise<boolean> {
  if (!uid || !storeId) return false;
  if (uid === storeId) return true;
  const profile = (await db.collection('storeProfiles').doc(storeId).get()).data();
  if (profile?.ownerId === uid) return true;
  return (await resolveStoreIdForOwnerUid(uid)) === storeId;
}

function generateEightDigitCode(): string {
  return String(Math.floor(10_000_000 + Math.random() * 90_000_000));
}

export async function createAccountingPairingCode(req: Request, res: Response): Promise<void> {
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

    const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
    if (!profileSnap.exists) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const profile = profileSnap.data() || {};
    const code = generateEightDigitCode();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + ACCOUNTING_PAIRING_TTL_SECONDS * 1000),
    );

    const pairingPayload = {
      code,
      storeId,
      storeName: String(profile.storeName || profile.name || 'Store').trim(),
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
    };

    await Promise.all([
      db.collection('stores').doc(storeId).collection('accountingPairingCodes').doc(code).set(pairingPayload),
      db.collection(ACCOUNTING_PAIRING_LOOKUP).doc(code).set(pairingPayload),
    ]);

    res.json({ success: true, code, expiresInSeconds: ACCOUNTING_PAIRING_TTL_SECONDS });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Pairing failed' });
  }
}

export async function pairExternalAccounting(req: Request, res: Response): Promise<void> {
  try {
    const { code, systemName } = req.body as { code?: string; systemName?: string };
    if (!code || !systemName) {
      res.status(400).json({ error: 'code and systemName required' });
      return;
    }

    const normalizedCode = String(code).replace(/\D/g, '');
    if (normalizedCode.length !== 8) {
      res.status(400).json({ error: 'Invalid pairing code' });
      return;
    }

    const lookupRef = db.collection(ACCOUNTING_PAIRING_LOOKUP).doc(normalizedCode);
    const lookupSnap = await lookupRef.get();
    if (!lookupSnap.exists) {
      res.status(404).json({ error: 'Pairing code not found or expired' });
      return;
    }

    const data = lookupSnap.data() || {};
    const expiresAt = data.expiresAt as { toMillis?: () => number } | undefined;
    if (!expiresAt?.toMillis || expiresAt.toMillis() < Date.now()) {
      await lookupRef.delete().catch(() => undefined);
      res.status(410).json({ error: 'Pairing code expired' });
      return;
    }

    const storeId = String(data.storeId || '').trim();
    if (!storeId) {
      res.status(500).json({ error: 'Invalid pairing record' });
      return;
    }

    const connectionId = crypto.randomBytes(16).toString('hex');
    const connectionToken = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    await Promise.all([
      db.collection('stores').doc(storeId).collection('accountingConnections').doc(connectionId).set({
        connectionId,
        systemName: String(systemName).trim().slice(0, 120),
        connectionToken,
        pairedAt: now,
        lastSeenAt: now,
        status: 'active',
      }),
      lookupRef.delete(),
      db.collection('stores').doc(storeId).collection('accountingPairingCodes').doc(normalizedCode).delete(),
    ]);

    res.json({
      success: true,
      storeId,
      storeName: data.storeName || null,
      connectionId,
      connectionToken,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Pairing failed' });
  }
}
