
import React, { useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { User, UserRole, Store } from '@/types/product';
import { auth, authReady } from '@/lib/firebase';
import { markGoogleAuthPending, clearGoogleAuthPending } from '@/lib/googleAuth';
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  User as FirebaseUser,
} from 'firebase/auth';
import { acquire, release } from '@/lib/popupLock';

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

import { getFirestore, doc, setDoc, collection, getCountFromServer, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { useCallback } from 'react';
import { resolveCrmRepUser, persistCrmRepSession, clearCrmRepSession } from '@/lib/crmAuth';

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
      console.error('Failed to load follows', err);
    }
  }, [db]);

    // Restore seller/admin info from localStorage on mount
    useEffect(() => {
      const savedSellerInfo = localStorage.getItem('sellerInfo');
        if (savedSellerInfo) {
          try {
            const sellerData = JSON.parse(savedSellerInfo);
            // Ensure storeId is set, use user id as fallback for admin/seller accounts
            const storeId = sellerData.storeId || (auth.currentUser ? auth.currentUser.uid : undefined);
            setUser((prev) => prev ? { ...prev, ...sellerData, role: sellerData.role || prev.role, storeId } : prev);
            // Update localStorage with storeId if it was missing
            if (!sellerData.storeId && storeId) {
              localStorage.setItem('sellerInfo', JSON.stringify({ ...sellerData, storeId }));
            }
          } catch (e) {
            console.error('Failed to parse sellerInfo from localStorage', e);
          }
        }
    }, []);



  const resolveFirebaseUser = useCallback(async (firebaseUser: FirebaseUser) => {
    let baseUser: User = {
      id: firebaseUser.uid,
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

    const userProfileRef = doc(db, 'users', firebaseUser.uid);
    const userProfileSnap = await getDoc(userProfileRef);

    if (userProfileSnap.exists()) {
      const userProfile = userProfileSnap.data();

      if (userProfile.role === 'sub_account' && userProfile.subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', userProfile.subAccountId);
        const subAccountSnap = await getDoc(subAccountRef);

        if (subAccountSnap.exists()) {
          const subAccountData = subAccountSnap.data();

          baseUser = {
            ...baseUser,
            name: subAccountData.name || baseUser.name,
            role: 'sub_account' as UserRole,
            storeId: subAccountData.storeId,
            subAccountRole: subAccountData.role,
            permissions: subAccountData.permissions,
            subAccountId: userProfile.subAccountId,
          };

          localStorage.setItem(
            'subAccountInfo',
            JSON.stringify({
              role: 'sub_account',
              subAccountRole: subAccountData.role,
              permissions: subAccountData.permissions,
              storeId: subAccountData.storeId,
              subAccountId: userProfile.subAccountId,
            }),
          );

          setUser(baseUser);
          await loadFollows(firebaseUser.uid);
          return;
        }
      }

      const crmRepUser = await resolveCrmRepUser(db, firebaseUser, baseUser);
      if (crmRepUser) {
        persistCrmRepSession(crmRepUser);
        setUser(crmRepUser);
        await loadFollows(firebaseUser.uid);
        return;
      }
    }

    const sellerRef = doc(db, 'sellers', firebaseUser.uid);
    const sellerSnap = await getDoc(sellerRef);
    if (sellerSnap.exists()) {
      const sellerData = sellerSnap.data();
      const storeId = sellerData.storeId || firebaseUser.uid;
      baseUser = { ...baseUser, ...sellerData, role: sellerData.role as UserRole, storeId };
      localStorage.setItem('sellerInfo', JSON.stringify({ ...sellerData, storeId }));
    }

    setUser(baseUser);
    await loadFollows(firebaseUser.uid);
  }, [db, loadFollows]);

  // Auth init: wait for persistence, subscribe to auth state immediately,
  // then call getRedirectResult non-blocking (it can hang in cross-origin setups).
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

      // Subscribe immediately — Firebase fires this after redirect/popup without
      // needing an explicit getRedirectResult call.
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (!mounted) return;
        console.log('[AuthContext] onAuthStateChanged fired, user:', firebaseUser?.email ?? null);

        if (!firebaseUser) {
          setUser(null);
          clearGoogleAuthPending();
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
            clearGoogleAuthPending();
            if (mounted) setIsLoading(false);
          });
      });

      // getRedirectResult non-blocking — only used to show a success toast.
      // Do NOT await this before subscribing; it can hang due to cross-origin
      // iframe restrictions when authDomain !== app origin (e.g. on localhost).
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user && mounted) {
            toast.success('Google sign-in successful');
          }
        })
        .catch((err: unknown) => {
          const code = (err as { code?: string })?.code;
          if (code && code !== 'auth/no-auth-event') {
            console.error('[AuthContext] Redirect result error:', err);
          }
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
      // Base user object
      let baseUser = {
        id: userCredential.user.uid,
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
            
            // Update last login
            await setDoc(subAccountRef, { lastLogin: new Date().toISOString() }, { merge: true });
            
            baseUser = {
              ...baseUser,
              name: subAccountData.name || baseUser.name,
              role: 'sub_account' as UserRole,
              storeId: subAccountData.storeId,
              subAccountRole: subAccountData.role,
              permissions: subAccountData.permissions,
              subAccountId: userProfile.subAccountId,
            };
            
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

        const crmRepUser = await resolveCrmRepUser(db, userCredential.user, baseUser as User);
        if (crmRepUser) {
          persistCrmRepSession(crmRepUser);
          setUser(crmRepUser);
          toast.success(`Welcome back, ${crmRepUser.name}!`);
          setIsLoading(false);
          return;
        }
      }
      
      // If not a sub-account, check for seller/admin info from Firestore
      const sellerRef = doc(db, 'sellers', userCredential.user.uid);
      const sellerSnap = await getDoc(sellerRef);
      if (sellerSnap.exists()) {
        const sellerData = sellerSnap.data();
        baseUser = { ...baseUser, ...sellerData, role: sellerData.role as UserRole };
        localStorage.setItem('sellerInfo', JSON.stringify(sellerData));
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
    if (!acquire()) {
      toast.error('Sign-in already in progress. Please complete the open sign-in window.');
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        toast.success('Google sign-in successful!');
      }
    } catch (error) {
      const e = error as { code?: string; message?: string };
      console.error('Google login error:', e);
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        // Fall back to full-page redirect when popup is explicitly blocked
        markGoogleAuthPending();
        release();
        await signInWithRedirect(auth, provider);
        return;
      }
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        toast.error(e?.message || 'An error occurred during Google login');
      }
    } finally {
      release();
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
        userId: user.id
      });
      // Update user context
      setUser((prev) => prev ? {
        ...prev,
        isSeller: true,
        sellerSince: new Date().toISOString(),
        sellerIndex: count,
        role: 'admin'
      } : prev);
      localStorage.setItem('sellerInfo', JSON.stringify({
        isSeller: true,
        sellerSince: new Date().toISOString(),
        sellerIndex: count,
        role: 'admin',
        userId: user.id
      }));
    } else {
      // If already seller, ensure role is admin in context and localStorage
      setUser((prev) => prev ? { ...prev, role: 'admin' } : prev);
      localStorage.setItem('sellerInfo', JSON.stringify({
        ...user,
        role: 'admin',
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
