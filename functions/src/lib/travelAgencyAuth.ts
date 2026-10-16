import { Request } from 'express';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export function getBearerToken(req: Request): string {
  const authHeader = req.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
}

export async function verifyUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing authorization');
  return admin.auth().verifyIdToken(token);
}

export async function assertStoreAccess(uid: string, storeId: string): Promise<void> {
  const storeSnap = await db.doc(`stores/${storeId}`).get();
  if (storeSnap.exists) {
    const ownerId = String(storeSnap.data()?.ownerId || '');
    if (ownerId === uid) return;
  }

  const profileSnap = await db.doc(`storeProfiles/${storeId}`).get();
  if (profileSnap.exists && String(profileSnap.data()?.ownerId || '') === uid) return;

  const subSnap = await db
    .collection('subAccounts')
    .where('storeId', '==', storeId)
    .where('userId', '==', uid)
    .limit(1)
    .get();
  if (!subSnap.empty) return;

  throw new Error('Forbidden for this store');
}
