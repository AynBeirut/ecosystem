import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User, UserRole } from '@/types/product';

type UserProfileDoc = {
  role?: string;
  subAccountId?: string;
  crmRepId?: string;
};

/**
 * If the Firebase user is a CRM rep, merge rep profile into the base user.
 * Returns null when not a CRM rep or rep doc missing.
 */
export async function resolveCrmRepUser(
  db: ReturnType<typeof import('firebase/firestore').getFirestore>,
  firebaseUser: FirebaseUser,
  baseUser: User,
): Promise<User | null> {
  const userProfileRef = doc(db, 'users', firebaseUser.uid);
  const userProfileSnap = await getDoc(userProfileRef);
  if (!userProfileSnap.exists()) return null;

  const userProfile = userProfileSnap.data() as UserProfileDoc;
  if (userProfile.role !== 'crm_rep' || !userProfile.crmRepId) return null;

  const crmRepRef = doc(db, 'crmReps', userProfile.crmRepId);
  const crmRepSnap = await getDoc(crmRepRef);
  if (!crmRepSnap.exists()) return null;

  const rep = crmRepSnap.data();
  if (rep.status === 'inactive' || rep.status === 'suspended') return null;

  await setDoc(crmRepRef, { lastLogin: new Date().toISOString() }, { merge: true });

  return {
    ...baseUser,
    name: (rep.name as string) || baseUser.name,
    role: 'crm_rep' as UserRole,
    storeId: rep.storeId as string,
    crmRepId: userProfile.crmRepId,
  };
}

export function persistCrmRepSession(user: User): void {
  if (user.role !== 'crm_rep' || !user.crmRepId) return;
  localStorage.setItem(
    'crmRepInfo',
    JSON.stringify({
      role: 'crm_rep',
      crmRepId: user.crmRepId,
      storeId: user.storeId,
    }),
  );
}

export function clearCrmRepSession(): void {
  localStorage.removeItem('crmRepInfo');
}
