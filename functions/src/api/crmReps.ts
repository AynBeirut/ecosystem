import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { canUseModule } from '../lib/entitlements';

function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

async function assertStoreOwner(req: Request): Promise<{ storeId: string; uid: string }> {
  const token = getBearerToken(req);
  if (!token) {
    throw Object.assign(new Error('Missing authorization'), { status: 401 });
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const storeId = String(req.body?.storeId || '').trim() || decoded.uid;

  if (decoded.uid !== storeId) {
    throw Object.assign(new Error('Only the store owner can manage CRM reps'), { status: 403 });
  }

  const db = admin.firestore();
  const profileSnap = await db.collection('storeProfiles').doc(storeId).get();
  if (!profileSnap.exists) {
    throw Object.assign(new Error('Store profile not found'), { status: 404 });
  }

  if (!canUseModule(profileSnap.data(), 'crm')) {
    throw Object.assign(new Error('Sales CRM is not enabled for this store'), { status: 403 });
  }

  return { storeId, uid: decoded.uid };
}

/**
 * Create CRM rep Auth user + Firestore docs via Admin SDK (owner session stays signed in).
 */
export async function createCrmRep(req: Request, res: Response): Promise<void> {
  try {
    const { storeId, uid } = await assertStoreOwner(req);

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'Name, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const db = admin.firestore();

    let userRecord: { uid: string };
    try {
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        emailVerified: false,
      });
    } catch (authErr: unknown) {
      const code = typeof authErr === 'object' && authErr && 'code' in authErr
        ? String((authErr as { code?: string }).code)
        : '';
      if (code === 'auth/email-already-exists') {
        res.status(409).json({ success: false, error: 'Email already in use' });
        return;
      }
      throw authErr;
    }

    const now = new Date().toISOString();
    const repRef = db.collection('crmReps').doc();

    try {
      await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
        tx.set(repRef, {
          storeId,
          name,
          email,
          phone: phone || null,
          status: 'active',
          firebaseUid: userRecord.uid,
          createdBy: uid,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(db.collection('users').doc(userRecord.uid), {
          email,
          name,
          role: 'crm_rep',
          storeId,
          crmRepId: repRef.id,
          createdAt: now,
        });
      });
    } catch (firestoreErr) {
      try {
        await admin.auth().deleteUser(userRecord.uid);
      } catch {
        // best effort rollback
      }
      throw firestoreErr;
    }

    res.json({
      success: true,
      repId: repRef.id,
      uid: userRecord.uid,
      email,
    });
  } catch (err: unknown) {
    const status = typeof err === 'object' && err && 'status' in err
      ? Number((err as { status?: number }).status) || 500
      : 500;
    const message = err instanceof Error ? err.message : 'Failed to create CRM rep';
    console.error('createCrmRep error:', err);
    res.status(status).json({ success: false, error: message });
  }
}
