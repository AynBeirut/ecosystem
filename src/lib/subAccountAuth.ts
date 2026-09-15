import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { User, UserRole } from '@/types/product';
import { resolveSubAccountBinding, storeIdHintFromUserProfile } from '@/lib/tenantBinding';

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
      const binding = await resolveSubAccountBinding(params.db, {
        subAccountId: String(userProfile.subAccountId),
        email: params.email,
        storeIdHint: storeIdHintFromUserProfile({
          subAccountId: String(userProfile.subAccountId),
          storeId: userProfile.storeId as string | undefined,
          primaryStoreId: userProfile.primaryStoreId as string | undefined,
          activeStoreId: userProfile.activeStoreId as string | undefined,
        }),
      });
      if (binding) {
        const roleFromSub = binding.subAccountRole;
        const storeId = binding.storeId;
        const needsPatch =
          userProfile.subAccountRole !== roleFromSub ||
          userProfile.storeId !== storeId ||
          userProfile.activeStoreId !== storeId;
        if (needsPatch) {
          await setDoc(
            userProfileRef,
            {
              subAccountRole: roleFromSub,
              storeId,
              activeStoreId: storeId,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        }
        return buildSubAccountResult(params, binding.subAccountId, {
          name: binding.name,
          storeId: binding.storeId,
          role: binding.subAccountRole,
          permissions: binding.permissions,
        });
      }
    }
  }

  const profileData = userProfileSnap.exists() ? userProfileSnap.data() : {};
  const storeHint = storeIdHintFromUserProfile({
    subAccountId: profileData?.subAccountId as string | undefined,
    storeId: profileData?.storeId as string | undefined,
    primaryStoreId: profileData?.primaryStoreId as string | undefined,
    activeStoreId: profileData?.activeStoreId as string | undefined,
  });

  const binding = await resolveSubAccountBinding(params.db, {
    subAccountId: profileData?.subAccountId as string | undefined,
    email: params.email,
    storeIdHint: storeHint,
  });
  if (!binding) return null;

  const resolvedName = String(binding.name || params.displayName || params.defaultUser.name || 'Sub-account');

  await setDoc(
    userProfileRef,
    {
      email: params.email || '',
      name: resolvedName,
      role: 'sub_account',
      storeId: binding.storeId,
      activeStoreId: binding.storeId,
      subAccountId: binding.subAccountId,
      subAccountRole: binding.subAccountRole,
      createdAt: profileData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  await setDoc(
    doc(params.db, 'subAccounts', binding.subAccountId),
    { userId: params.uid, updatedAt: new Date().toISOString() },
    { merge: true },
  );

  return buildSubAccountResult(params, binding.subAccountId, {
    name: binding.name,
    storeId: binding.storeId,
    role: binding.subAccountRole,
    permissions: binding.permissions,
  });
}
