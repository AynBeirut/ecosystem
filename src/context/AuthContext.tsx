
import React, { useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { User, UserRole, Store } from '@/types/product';
import { auth, authReady } from '@/lib/firebase';
import { markGoogleAuthPending, clearGoogleAuthPending, shouldUseGoogleRedirect, isGoogleAuthPending } from '@/lib/googleAuth';
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getRedirectResult,
  signInWithRedirect,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';

export type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  upgradeToAdmin: () => Promise<void>;
  followStore: (storeId: string) => Promise<void>;
  unfollowStore: (storeId: string) => Promise<void>;
};

import { AuthContext } from './AuthContextValue';

import { getFirestore, collection, doc, setDoc, getDoc, getDocFromServer, getDocs, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { useCallback } from 'react';
import { resolveCrmRepUser, persistCrmRepSession, clearCrmRepSession } from '@/lib/crmAuth';
import { resolveStoreIdForAuthUser } from '@/lib/storeUtils';
import { waitForAuthToken } from '@/lib/waitForAuthToken';
import { ensureSubAccountProfile } from '@/lib/subAccountAuth';
import { hydrateFreelancerUser, shouldHydrateFreelancerPortalUser } from '@/lib/freelancerAuth';
import { readFreelancerClientSessionFromStorage } from '@/types/subaccount';
import { consumeMobileSsoToken } from '@/lib/mobileAppSso';
import { resolveAdminDisplayName, resolveStoreOwnerDisplayName } from '@/lib/storeOwnerDisplay';

async function getUserDocPreferServer(db: ReturnType<typeof getFirestore>, uid: string) {
  const ref = doc(db, 'users', uid);
  try {
    return await getDocFromServer(ref);
  } catch {
    return getDoc(ref);
  }
}

async function getSubAccountDocPreferServer(db: ReturnType<typeof getFirestore>, subAccountId: string) {
  const ref = doc(db, 'subAccounts', subAccountId);
  try {
    return await getDocFromServer(ref);
  } catch {
    return getDoc(ref);
  }
}

async function hydrateAdminSellerUser(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  baseUser: User,
  hints?: { storeId?: string; sellerData?: Record<string, unknown>; userProfileName?: string },
): Promise<User> {
  const storeId =
    (typeof hints?.storeId === 'string' && hints.storeId.trim()) ||
    (typeof hints?.sellerData?.storeId === 'string' && String(hints.sellerData.storeId).trim()) ||
    uid;
  const displayName = resolveAdminDisplayName({
    userProfileName: hints?.userProfileName || baseUser.name,
    sellerName: typeof hints?.sellerData?.name === 'string' ? hints.sellerData.name : undefined,
    firebaseDisplayName: baseUser.name,
    email: baseUser.email,
  });
  let resolvedName = displayName;
  try {
    const ownerName = await resolveStoreOwnerDisplayName(storeId);
    if (ownerName && ownerName !== 'Store owner') resolvedName = ownerName;
  } catch {
    // keep displayName
  }
  const sellerPayload = {
    isSeller: true,
    role: 'admin' as UserRole,
    storeId,
    userId: uid,
    name: resolvedName,
    ...(hints?.sellerData || {}),
  };
  await setDoc(doc(db, 'sellers', uid), sellerPayload, { merge: true });
  await setDoc(
    doc(db, 'users', uid),
    {
      email: baseUser.email || '',
      name: resolvedName,
      role: 'admin',
      storeId,
      activeStoreId: storeId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  localStorage.removeItem('subAccountInfo');
  localStorage.setItem(
    'sellerInfo',
    JSON.stringify({ ...sellerPayload, sellerSince: hints?.sellerData?.sellerSince }),
  );
  return {
    ...baseUser,
    id: uid,
    ...sellerPayload,
    name: resolvedName,
    role: 'admin',
    storeId,
    isSeller: true,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const db = getFirestore();

  // Helper: load follows for current user and merge into user context
  const loadFollows = useCallback(async (uid: string) => {
    try {
      const followsRef = collection(db, 'users', uid, 'follows');
      const snaps = await getDocs(followsRef);
      const followingIds = snaps.docs.map(d => d.id);
      setUser(prev => prev ? { ...prev, following: followingIds } : prev);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Failed to load follows', err);
      }
    }
  }, [db]);

    // Restore seller/admin session from localStorage immediately so builder routes
    // don't flash /login while Firebase persistence + Firestore hydration finish.
    useEffect(() => {
      const activeClientSession = readFreelancerClientSessionFromStorage();
      if (activeClientSession) {
        const uid = auth.currentUser?.uid || '';
        setUser((prev) => {
          if (
            prev?.role === 'sub_account' &&
            prev.subAccountRole === activeClientSession.subAccountRole &&
            prev.id
          ) {
            return prev;
          }
          const base: User =
            prev ??
            ({
              id: uid,
              name: activeClientSession.subAccountRole === 'accounting' ? 'Accounting freelancer' : 'Web builder',
              email: '',
              role: 'sub_account',
              avatar:
                'https://ui-avatars.com/api/?name=Builder&background=38B2AC&color=fff',
              dailyAdsWatched: 0,
              lastAdWatchDate: new Date().toISOString().split('T')[0],
            } satisfies User);
          return {
            ...base,
            id: uid || base.id,
            role: 'sub_account',
            storeId: activeClientSession.storeId,
            subAccountRole: activeClientSession.subAccountRole,
            permissions: activeClientSession.permissions,
            subAccountId: activeClientSession.subAccountId,
          };
        });
        return;
      }

      const savedSubAccountInfo = localStorage.getItem('subAccountInfo');
      if (savedSubAccountInfo) {
        try {
          const subAccountData = JSON.parse(savedSubAccountInfo) as Record<string, unknown>;
          const uid = auth.currentUser?.uid || '';
          // Do not hydrate storeId from stale localStorage — wait for server tenant bind in resolveFirebaseUser.
          setUser((prev) => {
            if (prev?.role === 'sub_account' && prev.id && prev.storeId) return prev;
            const base: User =
              prev ??
              ({
                id: uid,
                name: 'Team member',
                email: '',
                role: 'sub_account',
                avatar:
                  'https://ui-avatars.com/api/?name=Team&background=38B2AC&color=fff',
                dailyAdsWatched: 0,
                lastAdWatchDate: new Date().toISOString().split('T')[0],
              } satisfies User);
            return {
              ...base,
              id: uid || base.id,
              role: 'sub_account',
              subAccountId:
                (typeof subAccountData.subAccountId === 'string' && subAccountData.subAccountId) ||
                base.subAccountId,
              subAccountRole:
                (subAccountData.subAccountRole as User['subAccountRole']) || base.subAccountRole,
              permissions: Array.isArray(subAccountData.permissions)
                ? (subAccountData.permissions as string[])
                : base.permissions,
            };
          });
        } catch (e) {
          console.error('Failed to parse subAccountInfo from localStorage', e);
        }
        return;
      }

      const savedSellerInfo = localStorage.getItem('sellerInfo');
      if (savedSellerInfo) {
        try {
          const sellerData = JSON.parse(savedSellerInfo) as Record<string, unknown>;
          const storeId =
            (typeof sellerData.storeId === 'string' && sellerData.storeId.trim()) ||
            auth.currentUser?.uid ||
            undefined;
          const uid =
            (typeof sellerData.userId === 'string' && sellerData.userId.trim()) ||
            auth.currentUser?.uid ||
            storeId ||
            '';
          setUser((prev) => {
            if (prev?.role === 'admin' && prev.id) return prev;
            const base: User =
              prev ??
              ({
                id: uid,
                name:
                  (typeof sellerData.name === 'string' && sellerData.name.trim()) ||
                  auth.currentUser?.displayName ||
                  (auth.currentUser?.email?.split('@')[0]) ||
                  'Store owner',
                email: '',
                role: 'admin',
                avatar:
                  'https://ui-avatars.com/api/?name=Admin&background=38B2AC&color=fff',
                dailyAdsWatched: 0,
                lastAdWatchDate: new Date().toISOString().split('T')[0],
              } satisfies User);
            return {
              ...base,
              ...sellerData,
              id: uid || base.id,
              role: (sellerData.role as UserRole) || 'admin',
              storeId: storeId || base.storeId,
              isSeller: true,
            };
          });
          if (!sellerData.storeId && storeId) {
            localStorage.setItem('sellerInfo', JSON.stringify({ ...sellerData, storeId }));
          }
        } catch (e) {
          console.error('Failed to parse sellerInfo from localStorage', e);
        }
        return;
      }
    }, []);



  const resolveFirebaseUser = useCallback(async (firebaseUser: FirebaseUser) => {
    await waitForAuthToken();

    const uid = firebaseUser.uid;
    let baseUser: User = {
      id: uid,
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      email: firebaseUser.email || '',
      role: 'user',
      avatar:
        firebaseUser.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=38B2AC&color=fff`,
      dailyAdsWatched: 0,
      lastAdWatchDate: new Date().toISOString().split('T')[0],
      storeId: undefined,
    };

    const userProfileRef = doc(db, 'users', uid);
    const userProfileSnap = await getUserDocPreferServer(db, uid);
    const platformFreelancerSnap = await getDoc(doc(db, 'platformFreelancers', uid));
    const isPlatformBuilder = platformFreelancerSnap.exists();

    if (userProfileSnap.exists()) {
      const userProfile = userProfileSnap.data();
      const activeClientSession = readFreelancerClientSessionFromStorage();
      const subAccountId =
        (typeof userProfile.subAccountId === 'string' && userProfile.subAccountId) ||
        activeClientSession?.subAccountId ||
        null;
      const shouldLoadClientSubAccount = Boolean(
        subAccountId &&
          userProfile.role !== 'freelancer' &&
          (
            userProfile.role === 'sub_account' ||
            userProfile.freelancerMode === true ||
            activeClientSession
          ),
      );

      if (shouldLoadClientSubAccount && subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', subAccountId);
        const subAccountSnap = await getSubAccountDocPreferServer(db, subAccountId);

        if (subAccountSnap.exists()) {
          const subAccountData = subAccountSnap.data();

          await setDoc(subAccountRef, { userId: uid, lastLogin: new Date().toISOString() }, { merge: true });

          await setDoc(
            userProfileRef,
            {
              role: 'sub_account',
              subAccountRole: subAccountData.role,
              storeId: subAccountData.storeId,
              activeStoreId: subAccountData.storeId,
              subAccountId,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );

          baseUser = {
            ...baseUser,
            id: uid,
            name: subAccountData.name || baseUser.name,
            role: 'sub_account' as UserRole,
            storeId: subAccountData.storeId,
            subAccountRole: subAccountData.role,
            permissions: subAccountData.permissions,
            subAccountId,
          };

          localStorage.removeItem('sellerInfo');
          localStorage.setItem(
            'subAccountInfo',
            JSON.stringify({
              role: 'sub_account',
              subAccountRole: subAccountData.role,
              permissions: subAccountData.permissions,
              storeId: subAccountData.storeId,
              subAccountId,
            }),
          );

          setUser(baseUser);
          await loadFollows(uid);
          return;
        }
      }

      if (shouldHydrateFreelancerPortalUser(userProfile)) {
        const freelancerUser = await hydrateFreelancerUser(db, uid, baseUser);
        if (freelancerUser) {
          setUser(freelancerUser);
          await loadFollows(uid);
          return;
        }
      }

      if (userProfile.role === 'admin') {
        const sellerSnap = await getDoc(doc(db, 'sellers', uid));
        const sellerData = sellerSnap.exists() ? sellerSnap.data() : {};
        const adminUser = await hydrateAdminSellerUser(db, uid, baseUser, {
          storeId: typeof userProfile.storeId === 'string' ? userProfile.storeId : undefined,
          sellerData,
          userProfileName: typeof userProfile.name === 'string' ? userProfile.name : undefined,
        });
        setUser(adminUser);
        await loadFollows(uid);
        return;
      }

      // Legacy store owners: users/{uid} may exist (dashboard prefs) without role — sellers doc is source of truth.
      const legacySellerSnap = await getDoc(doc(db, 'sellers', uid));
      if (legacySellerSnap.exists() && !isPlatformBuilder) {
        const legacySeller = legacySellerSnap.data();
        if (legacySeller?.role === 'admin' || legacySeller?.isSeller === true) {
          const adminUser = await hydrateAdminSellerUser(db, uid, baseUser, {
            storeId: typeof legacySeller.storeId === 'string' ? legacySeller.storeId : undefined,
            sellerData: legacySeller,
          });
          await setDoc(
            userProfileRef,
            {
              email: firebaseUser.email || userProfile.email || '',
              name: baseUser.name,
              role: 'admin',
              activeStoreId: adminUser.storeId,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
          setUser(adminUser);
          await loadFollows(uid);
          return;
        }
      }

      const repairedSubAccount = await ensureSubAccountProfile({
        db,
        uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName,
        defaultUser: baseUser,
      });

      if (repairedSubAccount) {
        const { user: repairedUser, subAccountInfo } = repairedSubAccount;
        localStorage.removeItem('sellerInfo');
        localStorage.setItem('subAccountInfo', JSON.stringify(subAccountInfo));
        setUser(repairedUser);
        await loadFollows(uid);
        return;
      }

      const crmRepUser = await resolveCrmRepUser(db, firebaseUser, baseUser);
      if (crmRepUser) {
        persistCrmRepSession({ ...crmRepUser, id: uid });
        setUser({ ...crmRepUser, id: uid });
        await loadFollows(uid);
        return;
      }
    }

    const sellerRef = doc(db, 'sellers', uid);
    const sellerSnap = await getDoc(sellerRef);
    if (sellerSnap.exists() && !isPlatformBuilder) {
      const sellerData = sellerSnap.data();
      const storeId = sellerData.storeId || uid;
      if (sellerData.role === 'admin' || sellerData.isSeller === true) {
        const adminUser = await hydrateAdminSellerUser(db, uid, baseUser, { storeId, sellerData });
        await setDoc(
          userProfileRef,
          {
            email: firebaseUser.email || '',
            name: baseUser.name,
            role: 'admin',
            activeStoreId: storeId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        setUser(adminUser);
        await loadFollows(uid);
        return;
      }
      baseUser = {
        ...baseUser,
        id: uid,
        ...sellerData,
        role: sellerData.role as UserRole,
        storeId,
      };
      localStorage.setItem('sellerInfo', JSON.stringify({ ...sellerData, storeId, userId: uid }));
    } else {
      try {
        const resolvedStoreId = await resolveStoreIdForAuthUser(uid);
        const profileSnap = await getDoc(doc(db, 'storeProfiles', resolvedStoreId));
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          const isOwner = profile.ownerId === uid || (!profile.ownerId && resolvedStoreId === uid);
          if (isOwner) {
            const storeId = resolvedStoreId;
            await setDoc(sellerRef, {
              isSeller: true,
              sellerSince: new Date().toISOString(),
              role: 'admin',
              storeId,
              userId: uid,
            }, { merge: true });
            await setDoc(userProfileRef, {
              email: firebaseUser.email || '',
              role: 'admin',
              activeStoreId: storeId,
            }, { merge: true });
            if (!profile.ownerId && resolvedStoreId === uid) {
              await setDoc(doc(db, 'storeProfiles', storeId), { ownerId: uid }, { merge: true });
            }
            baseUser = { ...baseUser, id: uid, role: 'admin', storeId, isSeller: true };
            localStorage.setItem('sellerInfo', JSON.stringify({
              isSeller: true,
              role: 'admin',
              storeId,
              userId: uid,
            }));
          }
        }
      } catch (bootstrapErr) {
        console.warn('[AuthContext] Store bootstrap skipped', bootstrapErr);
      }
    }

    setUser(baseUser);
    await loadFollows(uid);
  }, [db, loadFollows]);

  // Auth init: finish Google redirect (if any) before subscribing — avoids null flash → login loop.
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        await authReady;
      } catch (e) {
        console.error('[AuthContext] Persistence setup error:', e);
      }

      if (!mounted) return;

      try {
        await consumeMobileSsoToken();
      } catch {
        /* non-fatal — WebView may open login */
      }

      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user && mounted) {
          toast.success('Google sign-in successful');
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code && code !== 'auth/no-auth-event') {
          console.error('[AuthContext] Redirect result error:', err);
        }
      } finally {
        clearGoogleAuthPending();
      }

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!mounted) return;
        if (import.meta.env.DEV) {
          console.log('[AuthContext] onAuthStateChanged fired, user:', firebaseUser?.email ?? null);
        }

        if (!firebaseUser) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        void resolveFirebaseUser(firebaseUser)
          .catch((err) => {
            console.error('[AuthContext] Failed to resolve user profile:', err);
            setUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'user',
              avatar:
                firebaseUser.photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  firebaseUser.displayName || 'User',
                )}&background=38B2AC&color=fff`,
              dailyAdsWatched: 0,
              lastAdWatchDate: new Date().toISOString().split('T')[0],
            });
          })
          .finally(() => {
            if (mounted) setIsLoading(false);
          });
      });
    };

    void init();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [resolveFirebaseUser]);

  // Removed Supabase profile/role logic. User state is now managed by Firebase only.

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await waitForAuthToken();
      const uid = userCredential.user.uid;
      // Base user object
      let baseUser = {
        id: uid,
        name: userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
        email: userCredential.user.email || '',
        role: 'user',
        avatar: userCredential.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCredential.user.displayName || 'User')}&background=38B2AC&color=fff`,
        dailyAdsWatched: 0,
        lastAdWatchDate: new Date().toISOString().split('T')[0],
        storeId: undefined
      };
      
      // Check if this is a sub-account login
      const userProfileRef = doc(db, 'users', userCredential.user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      
      if (userProfileSnap.exists()) {
        const userProfile = userProfileSnap.data();

        // If this is a sub-account, load their profile and permissions
        if (userProfile.role === 'sub_account' && userProfile.subAccountId) {
          const subAccountRef = doc(db, 'subAccounts', userProfile.subAccountId);
          const subAccountSnap = await getDoc(subAccountRef);
          
          if (subAccountSnap.exists()) {
            const subAccountData = subAccountSnap.data();
            
            // Update last login + keep userId on sub-account for task assignment
            await setDoc(subAccountRef, { userId: uid, lastLogin: new Date().toISOString() }, { merge: true });

            await setDoc(
              userProfileRef,
              {
                subAccountRole: subAccountData.role,
                storeId: subAccountData.storeId,
                activeStoreId: subAccountData.storeId,
                subAccountId: userProfile.subAccountId,
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );
            
            baseUser = {
              ...baseUser,
              id: uid,
              name: subAccountData.name || baseUser.name,
              role: 'sub_account' as UserRole,
              storeId: subAccountData.storeId,
              subAccountRole: subAccountData.role,
              permissions: subAccountData.permissions,
              subAccountId: userProfile.subAccountId,
            };
            
            localStorage.removeItem('sellerInfo');
            localStorage.setItem('subAccountInfo', JSON.stringify({
              role: 'sub_account',
              subAccountRole: subAccountData.role,
              permissions: subAccountData.permissions,
              storeId: subAccountData.storeId,
              subAccountId: userProfile.subAccountId,
            }));
            
            setUser(baseUser as User);
            toast.success(`Welcome back, ${subAccountData.name}!`);
            setIsLoading(false);
            return;
          }
        }

        if (shouldHydrateFreelancerPortalUser(userProfile)) {
          const freelancerUser = await hydrateFreelancerUser(db, uid, baseUser as User);
          if (freelancerUser) {
            setUser(freelancerUser);
            toast.success(`Welcome back, ${freelancerUser.name}!`);
            setIsLoading(false);
            return;
          }
        }

        const repairedSubAccount = await ensureSubAccountProfile({
          db,
          uid,
          email: userCredential.user.email || '',
          displayName: userCredential.user.displayName,
          defaultUser: baseUser as User,
        });

        if (repairedSubAccount) {
          const { user: repairedUser, subAccountInfo } = repairedSubAccount;
          localStorage.removeItem('sellerInfo');
          localStorage.setItem('subAccountInfo', JSON.stringify(subAccountInfo));
          setUser(repairedUser);
          toast.success(`Welcome back, ${repairedUser.name}!`);
          setIsLoading(false);
          return;
        }

        const crmRepUser = await resolveCrmRepUser(db, userCredential.user, baseUser as User);
        if (crmRepUser) {
          persistCrmRepSession(crmRepUser);
          setUser({ ...crmRepUser, id: uid });
          await loadFollows(uid);
          setIsLoading(false);
          return;
        }

        if (userProfile.role === 'admin') {
          const sellerSnap = await getDoc(doc(db, 'sellers', uid));
          const sellerData = sellerSnap.exists() ? sellerSnap.data() : {};
          const adminUser = await hydrateAdminSellerUser(db, uid, baseUser as User, {
            storeId: typeof userProfile.storeId === 'string' ? userProfile.storeId : undefined,
            sellerData,
          });
          setUser(adminUser);
          toast.success('Logged in successfully');
          setIsLoading(false);
          return;
        }
      }
      
      // If not a sub-account, check for seller/admin info from Firestore
      const sellerRef = doc(db, 'sellers', userCredential.user.uid);
      const sellerSnap = await getDoc(sellerRef);
      if (sellerSnap.exists()) {
        const sellerData = sellerSnap.data();
        const storeId = sellerData.storeId || uid;
        baseUser = { ...baseUser, id: uid, ...sellerData, role: sellerData.role as UserRole, storeId };
        localStorage.setItem('sellerInfo', JSON.stringify({ ...sellerData, storeId, userId: uid }));
      }
      setUser(baseUser as User);
      toast.success('Logged in successfully');
    } catch (error) {
      const e = error as Error;
      toast.error(e.message || 'An error occurred during login');
      console.error('Login error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    if (shouldUseGoogleRedirect()) {
      markGoogleAuthPending();
      await signInWithRedirect(auth, provider);
      return;
    }

    try {
      setIsLoading(true);
      await signInWithPopup(auth, provider);
      toast.success('Google sign-in successful');
    } catch (error) {
      const e = error as { code?: string; message?: string };
      console.error('Google login error:', e);
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
        markGoogleAuthPending();
        await signInWithRedirect(auth, provider);
        return;
      }
      clearGoogleAuthPending();
      toast.error(e?.message || 'An error occurred during Google login');
    } finally {
      if (!shouldUseGoogleRedirect() && !isGoogleAuthPending()) {
        setIsLoading(false);
      }
    }
  };

  // Follow / unfollow helpers
  const followStore = async (storeId: string) => {
    // Allow using the currently authenticated user or the user in context
    const uid = auth.currentUser?.uid || user?.id;
    if (!uid) {
      toast.error('Please sign in to follow stores');
      throw new Error('Not authenticated');
    }

    // Optimistic update
    const prevFollowing = user?.following || [];
    setUser(prev => prev ? { ...prev, following: Array.from(new Set([...(prev.following || []), storeId])) } : prev);
    try {
      const followRef = doc(db, 'users', uid, 'follows', storeId);
      await setDoc(followRef, { followedAt: new Date().toISOString() });
      toast.success('Followed store');
    } catch (err) {
      console.error('Failed to follow store', { storeId, uid, err });
      // Revert optimistic update
      setUser(prev => prev ? { ...prev, following: prevFollowing } : prev);
      toast.error('Failed to follow store');
      throw err;
    }
  };

  const unfollowStore = async (storeId: string) => {
    const uid = auth.currentUser?.uid || user?.id;
    if (!uid) {
      toast.error('Please sign in to unfollow stores');
      throw new Error('Not authenticated');
    }

    // Optimistic update
    const prevFollowing = user?.following || [];
    setUser(prev => prev ? { ...prev, following: (prev.following || []).filter(id => id !== storeId) } : prev);
    try {
      const followRef = doc(db, 'users', uid, 'follows', storeId);
      await deleteDoc(followRef);
      toast.success('Unfollowed store');
    } catch (err) {
      console.error('Failed to unfollow store', { storeId, uid, err });
      // Revert optimistic update
      setUser(prev => prev ? { ...prev, following: prevFollowing } : prev);
      toast.error('Failed to unfollow store');
      throw err;
    }
  };

  // Removed Supabase upgradeToAdmin logic. Implement Firebase/Firestore logic if needed.

  // Removed Supabase updateStore logic. Implement Firebase/Firestore logic if needed.

  const upgradeToAdmin = async () => {
    if (!user) throw new Error('No user');
    const storeId = await resolveStoreIdForAuthUser(user.id);
    // Get seller count from Firestore
    const sellersCol = collection(db, 'sellers');
    const snapshot = await getCountFromServer(sellersCol);
    let count = snapshot.data().count || 0;
    if (!user.isSeller) {
      count += 1;
      // Save seller info to Firestore
      const sellerRef = doc(db, 'sellers', user.id);
      await setDoc(sellerRef, {
        isSeller: true,
        sellerSince: new Date().toISOString(),
        sellerIndex: count,
        role: 'admin',
        storeId,
        userId: user.id
      }, { merge: true });
      await setDoc(doc(db, 'users', user.id), {
        role: 'admin',
        storeId,
        email: user.email || '',
      }, { merge: true });
      // Update user context
      setUser((prev) => prev ? {
        ...prev,
        isSeller: true,
        sellerSince: new Date().toISOString(),
        sellerIndex: count,
        role: 'admin',
        storeId,
      } : prev);
      localStorage.setItem('sellerInfo', JSON.stringify({
        isSeller: true,
        sellerSince: new Date().toISOString(),
        sellerIndex: count,
        role: 'admin',
        storeId,
        userId: user.id
      }));
    } else {
      // If already seller, ensure role is admin in context and localStorage
      setUser((prev) => prev ? { ...prev, role: 'admin', storeId: prev.storeId || storeId } : prev);
      localStorage.setItem('sellerInfo', JSON.stringify({
        ...user,
        role: 'admin',
        storeId: user.storeId || storeId,
      }));
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      clearCrmRepSession();
      localStorage.removeItem('subAccountInfo');
      localStorage.removeItem('sellerInfo');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser,
      isLoading, 
      login,
      googleLogin,
      logout,
      upgradeToAdmin,
      followStore,
      unfollowStore,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// NOTE: the `useAuth` hook is provided from a separate file to keep this
// module exporting only React components for fast-refresh compatibility.
