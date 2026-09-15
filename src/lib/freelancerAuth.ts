import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { User, UserRole } from '@/types/product';
import type { PlatformFreelancer } from '@/types/career';

/** True when auth should restore portal freelancer identity (not an active client-store session). */
export function shouldHydrateFreelancerPortalUser(
  profile: Record<string, unknown> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'sub_account' && profile.subAccountId) return false;
  if (profile.freelancerMode === true) return false;
  return profile.role === 'freelancer' || Boolean(profile.freelancerTrack);
}

export async function hydrateFreelancerUser(
  db: Firestore,
  uid: string,
  baseUser: User,
): Promise<User | null> {
  const snap = await getDoc(doc(db, 'platformFreelancers', uid));
  if (!snap.exists()) return null;

  const profile = snap.data() as PlatformFreelancer;
  if (profile.status === 'suspended') return null;

  return {
    ...baseUser,
    id: uid,
    role: 'freelancer' as UserRole,
    name: profile.displayName || baseUser.name,
    email: profile.email || baseUser.email,
    freelancerTrack: profile.track,
    storeId: profile.clientStoreIds?.[0],
  };
}
