import { doc, getDoc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { storeIdHintFromUserProfile } from '@/lib/tenantBinding';

async function getDocPreferServer(ref: ReturnType<typeof doc>) {
  try {
    return await getDocFromServer(ref);
  } catch {
    return getDoc(ref);
  }
}

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

  const userSnap = await getDocPreferServer(doc(db, 'users', authUid));
  if (userSnap.exists()) {
    const data = userSnap.data();
    const subAccountId =
      (typeof data?.subAccountId === 'string' && data.subAccountId.trim()) || '';
    if (subAccountId) {
      const subSnap = await getDocPreferServer(doc(db, 'subAccounts', subAccountId));
      if (subSnap.exists()) {
        const subStoreId = subSnap.data()?.storeId;
        if (typeof subStoreId === 'string' && subStoreId.trim()) {
          return subStoreId.trim();
        }
      }
    }
    const storeIdField = storeIdHintFromUserProfile({
      subAccountId: subAccountId || undefined,
      storeId: data?.storeId as string | undefined,
      primaryStoreId: data?.primaryStoreId as string | undefined,
      activeStoreId: data?.activeStoreId as string | undefined,
    });
    if (storeIdField) return storeIdField;
  }

  return authUid;
}
