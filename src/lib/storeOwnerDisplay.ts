import { doc, getDoc, getFirestore } from 'firebase/firestore';

/** Owner display name for CRM labels (e.g. y.malek — not generic "Store admin"). */
export async function resolveStoreOwnerDisplayName(storeId: string): Promise<string> {
  const db = getFirestore();
  const profileSnap = await getDoc(doc(db, 'storeProfiles', storeId));
  const profile = profileSnap.data() || {};
  const ownerUid = typeof profile.ownerId === 'string' ? profile.ownerId.trim() : '';
  if (ownerUid) {
    const userSnap = await getDoc(doc(db, 'users', ownerUid));
    if (userSnap.exists()) {
      const u = userSnap.data() || {};
      const name = String(u.name || u.displayName || '').trim();
      if (name) return name;
      const email = String(u.email || '').trim();
      if (email.includes('@')) return email.split('@')[0];
    }
    const sellerSnap = await getDoc(doc(db, 'sellers', ownerUid));
    if (sellerSnap.exists()) {
      const name = String(sellerSnap.data()?.name || '').trim();
      if (name) return name;
    }
  }
  return String(profile.storeName || profile.name || 'Store owner').trim();
}

export function nameFromEmail(email?: string | null): string | null {
  const e = (email || '').trim();
  if (!e.includes('@')) return null;
  return e.split('@')[0] || null;
}

export function resolveAdminDisplayName(input: {
  userProfileName?: string;
  sellerName?: string;
  firebaseDisplayName?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const fromProfile = (input.userProfileName || '').trim();
  if (fromProfile && fromProfile.toLowerCase() !== 'store admin') return fromProfile;
  const fromSeller = (input.sellerName || '').trim();
  if (fromSeller) return fromSeller;
  const fromFirebase = (input.firebaseDisplayName || '').trim();
  if (fromFirebase) return fromFirebase;
  const fromEmail = nameFromEmail(input.email);
  if (fromEmail) return fromEmail;
  return input.fallback || 'Store owner';
}
