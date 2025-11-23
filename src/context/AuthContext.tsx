
import React, { useState, useEffect } from 'react';
import { toast } from '@/components/ui/sonner';
import { User, UserRole, Store } from '@/types/product';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithRedirect, getRedirectResult, User as FirebaseUser } from 'firebase/auth';
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
            setUser((prev) => prev ? { ...prev, ...sellerData, role: sellerData.role || prev.role } : prev);
          } catch (e) {
            console.error('Failed to parse sellerInfo from localStorage', e);
          }
        }
    }, []);

    // Always fetch and set storeId after login or auth state change
    useEffect(() => {
      const fetchAndSetStoreId = async (firebaseUser: FirebaseUser) => {
        if (!firebaseUser) return;
        const db = getFirestore();
        // Try to find a store profile with this user as owner
        const storeProfileRef = doc(db, 'storeProfiles', firebaseUser.uid);
        const storeProfileSnap = await getDoc(storeProfileRef);
        let storeId = undefined;
        if (storeProfileSnap.exists()) {
          storeId = storeProfileSnap.id;
        }
        // Update user context and localStorage
        setUser((prev) => prev ? { ...prev, storeId } : prev);
        // Also update sellerInfo in localStorage if present
        const savedSellerInfo = localStorage.getItem('sellerInfo');
        if (savedSellerInfo) {
          try {
            const sellerData = JSON.parse(savedSellerInfo);
            sellerData.storeId = storeId;
            localStorage.setItem('sellerInfo', JSON.stringify(sellerData));
          } catch (e) {
            console.error('Failed to parse sellerInfo while updating storeId', e);
          }
        }
      };
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          fetchAndSetStoreId(firebaseUser);
        }
      });
      return () => unsubscribe();
    }, []);

  // Check if user is already logged in and listen for auth changes
  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // Try to restore seller/admin info from localStorage
          const savedSellerInfo = localStorage.getItem('sellerInfo');
          let role: UserRole = 'user';
          let isSeller = false;
          let sellerSince = undefined;
          let sellerIndex = undefined;
          if (savedSellerInfo) {
            try {
              const sellerData = JSON.parse(savedSellerInfo);
              role = sellerData.role || 'user';
              isSeller = sellerData.isSeller || false;
              sellerSince = sellerData.sellerSince;
              sellerIndex = sellerData.sellerIndex;
            } catch (e) {
              console.error('Failed to parse sellerInfo from localStorage', e);
            }
          }
          const baseUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role,
            avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=38B2AC&color=fff`,
            dailyAdsWatched: 0,
            lastAdWatchDate: new Date().toISOString().split('T')[0],
            storeId: savedSellerInfo ? JSON.parse(savedSellerInfo).storeId : undefined,
            isSeller,
            sellerSince,
            sellerIndex,
          };
          setUser(baseUser);
          // Load follows into user context
          await loadFollows(firebaseUser.uid);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });
    return () => unsubscribe();
  }, [loadFollows]);

  // Handle redirect result for Google sign-in
  // Handle redirect result for Google sign-in
  useEffect(() => {
    getRedirectResult(auth).then((result) => {
      if (result && result.user) {
        const firebaseUser = result.user;
        const baseUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          role: 'user' as UserRole,
          avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=38B2AC&color=fff`,
          dailyAdsWatched: 0,
          lastAdWatchDate: new Date().toISOString().split('T')[0],
          storeId: undefined
        };
        setUser(baseUser);
        toast.success('Google login successful!');
      }
    }).catch((error) => {
      console.error('Redirect result error:', error);
      toast.error('Google login failed');
    });
  }, []);

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
      // Fetch seller info from Firestore
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
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      if (window.location.hostname === 'localhost') {
        // Use popup for local dev to avoid sessionStorage/redirect issues
        const result = await import('firebase/auth').then(m => m.signInWithPopup(auth, provider));
        if (result && result.user) {
          console.log('[AuthContext] signInWithPopup user:', result.user);
          toast.success('Google login successful!');
        }
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (error) {
      const e = error as { code?: string; message?: string; name?: string };
      console.error('Google login error:', e);
      toast.error(e?.message || 'An error occurred during Google login');
    } finally {
      setIsLoading(false);
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
