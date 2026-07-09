import * as admin from 'firebase-admin';

const db = admin.firestore();

/** Resolve the store owner's Firebase Auth uid from storeProfiles.ownerId. */
export async function resolveStoreOwnerUserId(storeId: string): Promise<string | null> {
  if (!storeId) return null;

  const storeSnap = await db.collection('storeProfiles').doc(storeId).get();
  if (storeSnap.exists) {
    const ownerId = storeSnap.data()?.ownerId;
    if (typeof ownerId === 'string' && ownerId) return ownerId;
  }

  const userSnap = await db.collection('users').where('storeId', '==', storeId).limit(1).get();
  if (!userSnap.empty) return userSnap.docs[0].id;

  return null;
}

export async function getFcmTokensForUser(userId: string): Promise<string[]> {
  if (!userId) return [];
  const fcmSnap = await db.collection('users').doc(userId).collection('fcmTokens').get();
  return fcmSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => d.id).filter(Boolean);
}

export async function getFcmTokensForStoreOwner(storeId: string): Promise<string[]> {
  const ownerId = await resolveStoreOwnerUserId(storeId);
  if (!ownerId) return [];
  return getFcmTokensForUser(ownerId);
}

export async function sendFcmMulticast(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) return;
  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  });
}
