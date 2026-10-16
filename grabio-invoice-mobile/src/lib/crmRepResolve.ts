import firestore from '@react-native-firebase/firestore';

export type RepUser = {
  uid: string;
  email?: string | null;
  storeId?: string;
  crmRepId?: string;
  subAccountId?: string;
  userRole?: string;
};

/** Resolve team rep id for CRM task assignment filters (`crmTasks`). */
export async function resolveMobileCrmRepId(user: RepUser): Promise<string | null> {
  if (user.userRole === 'owner' && user.storeId) return `owner:${user.storeId}`;
  if (user.userRole === 'crm_rep' && user.crmRepId) return user.crmRepId;
  if (!user.storeId) return null;

  if (user.subAccountId && (user.userRole === 'sub_seller' || user.userRole === 'sub_manager')) {
    return `sub:${user.subAccountId}`;
  }

  const email = (user.email || '').trim().toLowerCase();
  if (email) {
    try {
      const repSnap = await firestore()
        .collection('crmReps')
        .where('storeId', '==', user.storeId)
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!repSnap.empty) return repSnap.docs[0].id;
    } catch {
      // optional crmReps id
    }
  }

  if (user.subAccountId) return `sub:${user.subAccountId}`;
  if (user.userRole === 'sub_seller' || user.userRole === 'sub_manager' || user.userRole === 'crm_rep') {
    return `user:${user.uid}`;
  }

  return null;
}

export function isFieldSalesRep(userRole?: string): boolean {
  return userRole === 'sub_seller';
}

export function hasStoreAdminAccess(userRole?: string, subAccountRole?: string): boolean {
  return (
    userRole === 'owner'
    || userRole === 'admin'
    || userRole === 'sub_manager'
    || subAccountRole === 'manager'
  );
}
