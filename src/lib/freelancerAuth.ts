import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { User, UserRole } from '@/types/product';
import type { PlatformFreelancer } from '@/types/career';

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
