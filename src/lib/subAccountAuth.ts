import { collection, doc, getDoc, getDocs, setDoc, query, where, limit, type Firestore } from 'firebase/firestore';
import type { User, UserRole } from '@/types/product';

type SubAccountAuthResult = {
  user: User;
  subAccountInfo: {
    role: 'sub_account';
    subAccountRole: string;
    permissions: string[];
    storeId: string;
    subAccountId: string;
  };
};

type EnsureSubAccountProfileParams = {
  db: Firestore;
  uid: string;
  email: string;
  displayName?: string | null;
  defaultUser: User;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildSubAccountResult(
  params: EnsureSubAccountProfileParams,
  subAccountId: string,
  subAccountData: Record<string, unknown>,
): SubAccountAuthResult {
  const resolvedName = String(subAccountData?.name || params.displayName || params.defaultUser.name || 'Sub-account');
  const resolvedStoreId = String(subAccountData?.storeId || params.defaultUser.storeId || '');
  const resolvedRole = String(subAccountData?.role || 'sales');
  const permissions = Array.isArray(subAccountData?.permissions)
    ? (subAccountData.permissions as string[])
    : [];

  const user: User = {
    ...params.defaultUser,
    id: params.uid,
    name: resolvedName,
    email: params.email || params.defaultUser.email || '',
    role: 'sub_account' as UserRole,
    storeId: resolvedStoreId,
    subAccountRole: resolvedRole as User['subAccountRole'],
    permissions,
    subAccountId,
  };

  return {
    user,
    subAccountInfo: {
      role: 'sub_account',
      subAccountRole: resolvedRole,
      permissions,
      storeId: resolvedStoreId,
      subAccountId,
    },
  };
}

async function findSubAccountByEmail(db: Firestore, email: string) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const byEmail = await getDocs(
      query(collection(db, 'subAccounts'), where('email', '==', normalizedEmail), limit(1)),
    );
    if (!byEmail.empty) return byEmail.docs[0];
  } catch {
    // Rules may deny email lookup until the user is linked — fall through.
  }

  return null;
}

export async function ensureSubAccountProfile(
  params: EnsureSubAccountProfileParams,
): Promise<SubAccountAuthResult | null> {
  const sellerSnap = await getDoc(doc(params.db, 'sellers', params.uid));
  if (sellerSnap.exists()) {
    const seller = sellerSnap.data();
    if (seller?.role === 'admin' || seller?.isSeller === true) {
      return null;
    }
  }

  const freelancerSnap = await getDoc(doc(params.db, 'platformFreelancers', params.uid));
  if (freelancerSnap.exists()) {
    return null;
  }

  const userProfileRef = doc(params.db, 'users', params.uid);
  const userProfileSnap = await getDoc(userProfileRef);

  if (userProfileSnap.exists()) {
    const userProfile = userProfileSnap.data();
    if (userProfile?.role === 'admin') {
      return null;
    }
    if (userProfile?.role === 'sub_account' && userProfile?.subAccountId) {
      const subAccountRef = doc(params.db, 'subAccounts', userProfile.subAccountId);
      const subAccountSnap = await getDoc(subAccountRef);
      if (subAccountSnap.exists()) {
        return buildSubAccountResult(params, userProfile.subAccountId, subAccountSnap.data() as Record<string, unknown>);
      }
    }
  }

  const matchingSubAccount = await findSubAccountByEmail(params.db, params.email);
  if (!matchingSubAccount) return null;

  const subAccountData = matchingSubAccount.data() as Record<string, unknown>;
  const subAccountId = matchingSubAccount.id;
  const resolvedName = String(subAccountData?.name || params.displayName || params.defaultUser.name || 'Sub-account');
  const resolvedStoreId = String(subAccountData?.storeId || params.defaultUser.storeId || '');

  await setDoc(
    userProfileRef,
    {
      email: params.email || '',
      name: resolvedName,
      role: 'sub_account',
      storeId: resolvedStoreId,
      subAccountId,
      createdAt: subAccountData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  return buildSubAccountResult(params, subAccountId, subAccountData);
}
