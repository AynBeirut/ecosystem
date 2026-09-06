import firestore from '@react-native-firebase/firestore';

export type RepUser = {
  uid: string;
  email?: string | null;
  storeId?: string;
  crmRepId?: string;
  subAccountId?: string;
  userRole?: string;
};

/** Canonical rep id for visit routes + client assignment (prefer sub: for team logins). */
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

/** All rep ids that may appear on assignedRepId for this user. */
export async function collectMobileCrmRepIds(user: RepUser): Promise<string[]> {
  const ids = new Set<string>();
  const primary = await resolveMobileCrmRepId(user);
  if (primary) ids.add(primary);
  if (user.subAccountId) ids.add(`sub:${user.subAccountId}`);
  ids.add(`user:${user.uid}`);

  if (user.storeId && user.email) {
    try {
      const repSnap = await firestore()
        .collection('crmReps')
        .where('storeId', '==', user.storeId)
        .where('email', '==', user.email.trim().toLowerCase())
        .limit(1)
        .get();
      if (!repSnap.empty) ids.add(repSnap.docs[0].id);
    } catch {
      // optional crmReps id
    }
  }

  return [...ids];
}

export function isCrmManagerRole(userRole?: string, subAccountRole?: string): boolean {
  return userRole === 'owner' || userRole === 'sub_manager' || subAccountRole === 'manager';
}

/** Pure sales rep — own clients/orders only (not sales manager). */
export function isFieldSalesRep(userRole?: string): boolean {
  return userRole === 'sub_seller';
}

/** Sales rep or sales manager — can be assigned CRM visit routes. */
export function isCrmRouteAgent(userRole?: string, subAccountRole?: string): boolean {
  return (
    userRole === 'sub_seller'
    || userRole === 'sub_manager'
    || subAccountRole === 'sales'
    || subAccountRole === 'manager'
  );
}

/** Store admin — full visibility (owner, Firestore admin, manager). */
export function hasStoreAdminAccess(userRole?: string, subAccountRole?: string): boolean {
  return (
    userRole === 'owner'
    || userRole === 'admin'
    || userRole === 'sub_manager'
    || subAccountRole === 'manager'
  );
}

/** Store owner, Firestore admin, or sales manager — manage custom CRM areas. */
export function canManageCrmStoreAreas(userRole?: string, subAccountRole?: string): boolean {
  return hasStoreAdminAccess(userRole, subAccountRole);
}

export function canAssignCrmClients(userRole?: string, subAccountRole?: string): boolean {
  return hasStoreAdminAccess(userRole, subAccountRole);
}

export function canFilterBySalesAgent(userRole?: string, subAccountRole?: string): boolean {
  return hasStoreAdminAccess(userRole, subAccountRole);
}

/** Sales rep or manager — can capture GPS and assign to a client on a visit. */
export function canAssignClientGpsLocation(userRole?: string, subAccountRole?: string): boolean {
  return (
    userRole === 'owner'
    || userRole === 'sub_seller'
    || userRole === 'sub_manager'
    || userRole === 'crm_rep'
    || subAccountRole === 'sales'
    || subAccountRole === 'manager'
  );
}
