import type { Firestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

export function hashPosDeviceToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export type PosDeviceAuthResult =
  | { ok: true; storeId: string; deviceId: string; deviceData: FirebaseFirestore.DocumentData }
  | { ok: false; status: 400 | 401; error: string };

export async function verifyPosDevice(
  db: Firestore,
  storeId: string,
  deviceId: string,
  deviceToken: string,
): Promise<PosDeviceAuthResult> {
  if (!storeId || !deviceId || !deviceToken) {
    return { ok: false, status: 400, error: 'storeId, deviceId, and deviceToken required' };
  }

  const deviceRef = db.collection('stores').doc(storeId).collection('posDevices').doc(deviceId);
  const deviceSnap = await deviceRef.get();
  if (!deviceSnap.exists) {
    return { ok: false, status: 401, error: 'Invalid device token' };
  }

  const expected = deviceSnap.data()?.apiKeyHash;
  if (expected !== hashPosDeviceToken(deviceToken)) {
    return { ok: false, status: 401, error: 'Invalid device token' };
  }

  return {
    ok: true,
    storeId,
    deviceId,
    deviceData: deviceSnap.data() as FirebaseFirestore.DocumentData,
  };
}
