import { doc, getDoc, getFirestore } from 'firebase/firestore';

/**
 * Get the actual store ID for the current user.
 * For regular admins, this is their user.id.
 * For sub-accounts, this is their user.storeId.
 */
export function getActualStoreId(user: { id: string; storeId?: string } | null): string | null {
  if (!user?.id) return null;
  return user.storeId || user.id;
}

/** Resolve canonical storeProfiles doc id from Firestore (sellers → users → uid). */
export async function resolveStoreIdForAuthUser(authUid: string): Promise<string> {
  if (!authUid) return authUid;
  const db = getFirestore();

  const sellerSnap = await getDoc(doc(db, 'sellers', authUid));
  if (sellerSnap.exists()) {
    const storeId = sellerSnap.data()?.storeId;
    if (typeof storeId === 'string' && storeId.trim()) {
      return storeId.trim();
    }
  }

  const userSnap = await getDoc(doc(db, 'users', authUid));
  if (userSnap.exists()) {
    const data = userSnap.data();
    const active =
      (typeof data?.activeStoreId === 'string' && data.activeStoreId.trim()) ||
      (typeof data?.primaryStoreId === 'string' && data.primaryStoreId.trim()) ||
      '';
    if (active) return active;
  }

  return authUid;
}
