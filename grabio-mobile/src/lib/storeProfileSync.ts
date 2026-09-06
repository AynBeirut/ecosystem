import firestore from '@react-native-firebase/firestore';

export type GrabioStoreProfile = {
  id: string;
  name: string;
  storeName: string;
  description: string;
  phone: string;
  email: string;
  location: string;
  website: string;
  whatsappNumber?: string;
  autoAcceptOrders: boolean;
};

export type NotifPref = 'all' | 'gentle' | 'off';

const NOTIF_PREFS: NotifPref[] = ['all', 'gentle', 'off'];

export function normalizeNotifPref(value: unknown): NotifPref {
  return NOTIF_PREFS.includes(value as NotifPref) ? (value as NotifPref) : 'all';
}

/** Store team (sub-accounts + CRM reps) always receive full alerts. */
export function isStoreTeamMember(userRole?: string): boolean {
  return ['sub_seller', 'sub_manager', 'sub_delivery', 'crm_rep'].includes(userRole || '');
}

export function notifPrefForUser(userRole?: string, stored?: unknown): NotifPref {
  if (isStoreTeamMember(userRole)) return 'all';
  return normalizeNotifPref(stored);
}

/** Owner display name for CRM labels (e.g. y.malek — not generic "Store admin"). */
export async function resolveStoreOwnerDisplayName(storeId: string): Promise<string> {
  const profileSnap = await firestore().collection('storeProfiles').doc(storeId).get();
  const profile = profileSnap.data() || {};
  const ownerUid = typeof profile.ownerId === 'string' ? profile.ownerId.trim() : '';
  if (ownerUid) {
    const userSnap = await firestore().collection('users').doc(ownerUid).get();
    if (userSnap.exists()) {
      const u = userSnap.data() || {};
      const name = String(u.name || u.displayName || '').trim();
      if (name) return name;
      const email = String(u.email || '').trim();
      if (email.includes('@')) return email.split('@')[0];
    }
  }
  return String(profile.storeName || profile.name || 'Store owner').trim();
}

async function loadSubAccountRecord(
  subAccountId?: string,
  email?: string | null,
  storeId?: string,
): Promise<{ name: string; role: string } | null> {
  if (subAccountId) {
    const subSnap = await firestore().collection('subAccounts').doc(subAccountId).get();
    if (subSnap.exists()) {
      const sub = subSnap.data() || {};
      return {
        name: String(sub.name || '').trim(),
        role: String(sub.role || 'sales'),
      };
    }
  }
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !storeId) return null;
  const byEmail = await firestore()
    .collection('subAccounts')
    .where('storeId', '==', storeId)
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();
  if (byEmail.empty) return null;
  const sub = byEmail.docs[0].data() || {};
  return {
    name: String(sub.name || '').trim(),
    role: String(sub.role || 'sales'),
  };
}

export type GrabioUserProfile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  preferredPayment: string;
  notifPref: NotifPref;
  roleLabel: string;
  subAccountRole?: string;
  isSubAccount: boolean;
};

/** Same resolution order as grabio.space `resolveStoreIdForAuthUser`. */
export async function resolveStoreIdForMobile(authUid: string, hintStoreId?: string): Promise<string> {
  if (hintStoreId?.trim()) {
    const hinted = await firestore().collection('storeProfiles').doc(hintStoreId.trim()).get();
    if (hinted.exists()) return hintStoreId.trim();
  }

  const sellerSnap = await firestore().collection('sellers').doc(authUid).get();
  if (sellerSnap.exists()) {
    const storeId = sellerSnap.data()?.storeId;
    if (typeof storeId === 'string' && storeId.trim()) return storeId.trim();
  }

  const userSnap = await firestore().collection('users').doc(authUid).get();
  if (userSnap.exists()) {
    const data = userSnap.data() || {};
    if (data.role === 'sub_account' && typeof data.subAccountId === 'string' && data.subAccountId.trim()) {
      const subSnap = await firestore().collection('subAccounts').doc(data.subAccountId.trim()).get();
      if (subSnap.exists()) {
        const subStoreId = subSnap.data()?.storeId;
        if (typeof subStoreId === 'string' && subStoreId.trim()) {
          const profileSnap = await firestore().collection('storeProfiles').doc(subStoreId.trim()).get();
          if (profileSnap.exists()) return subStoreId.trim();
        }
      }
    }
    const fromUser =
      (typeof data.storeId === 'string' && data.storeId.trim()) ||
      (typeof data.activeStoreId === 'string' && data.activeStoreId.trim()) ||
      (typeof data.primaryStoreId === 'string' && data.primaryStoreId.trim()) ||
      '';
    if (fromUser) {
      const profileSnap = await firestore().collection('storeProfiles').doc(fromUser).get();
      if (profileSnap.exists()) return fromUser;
    }
  }

  const ownerSnap = await firestore()
    .collection('storeProfiles')
    .where('ownerId', '==', authUid)
    .limit(1)
    .get();
  if (!ownerSnap.empty) return ownerSnap.docs[0].id;

  return hintStoreId?.trim() || authUid;
}

export async function loadGrabioStoreProfile(storeId: string): Promise<GrabioStoreProfile | null> {
  const snap = await firestore().collection('storeProfiles').doc(storeId).get({ source: 'server' }).catch(
    () => firestore().collection('storeProfiles').doc(storeId).get(),
  );
  if (!snap.exists()) return null;
  const d = snap.data() || {};
  return {
    id: storeId,
    name: String(d.name || d.storeName || '').trim(),
    storeName: String(d.storeName || d.name || '').trim(),
    description: String(d.description || '').trim(),
    phone: String(d.phone || '').trim(),
    email: String(d.email || '').trim(),
    location: String(d.location || '').trim(),
    website: String(d.website || '').trim(),
    whatsappNumber: String(d.whatsappNumber || d.whatsappBusiness || '').trim() || undefined,
    autoAcceptOrders: d.deliverySettings?.autoAcceptOrders === true,
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Store admin',
  owner: 'Store owner',
  sales: 'Sales',
  manager: 'Manager',
  delivery: 'Delivery',
  crm_rep: 'CRM rep',
};

export async function loadGrabioUserProfile(
  uid: string,
  authEmail?: string | null,
  storeId?: string,
): Promise<GrabioUserProfile> {
  const snap = await firestore().collection('users').doc(uid).get({ source: 'server' }).catch(
    () => firestore().collection('users').doc(uid).get(),
  );
  const d = snap.exists() ? snap.data() || {} : {};

  let name = String(d.name || d.displayName || '').trim();
  let subAccountRole = typeof d.subAccountRole === 'string' ? d.subAccountRole : undefined;
  const role = String(d.role || '');

  const subRecord =
    role === 'sub_account'
      ? await loadSubAccountRecord(
          d.subAccountId ? String(d.subAccountId) : undefined,
          String(d.email || authEmail || ''),
          storeId,
        ).catch(() => null)
      : null;
  if (subRecord) {
    if (subRecord.name) name = subRecord.name;
    subAccountRole = subRecord.role || subAccountRole;
  }

  const roleKey = role === 'sub_account'
    ? subAccountRole || 'sales'
    : (role === 'admin' ? 'owner' : role);
  const roleLabel = ROLE_LABELS[roleKey] || ROLE_LABELS.sales;

  const isSubAccount = role === 'sub_account';

  return {
    name,
    email: String(d.email || authEmail || '').trim(),
    phone: String(d.phone || '').trim(),
    address: String(d.address || '').trim(),
    city: String(d.city || '').trim(),
    preferredPayment: String(d.preferredPayment || 'cashOnDelivery'),
    notifPref: isSubAccount ? 'all' : normalizeNotifPref(d.notifPref),
    roleLabel,
    subAccountRole,
    isSubAccount,
  };
}
