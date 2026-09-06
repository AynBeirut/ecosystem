import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  getFirestore,
  collection,
  where,
  limit,
  getDocs,
  getDoc,
  query,
  doc,
  setDoc,
} from '@react-native-firebase/firestore';
import { isStoreTeamMember } from '../lib/storeProfileSync';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  teamMemberName?: string;
  isStoreOwner: boolean;
  storeId?: string;
  userRole: 'owner' | 'sub_seller' | 'sub_manager' | 'sub_delivery' | 'crm_rep' | 'buyer';
  subAccountRole?: 'sales' | 'delivery' | 'manager';
  subAccountId?: string;
  crmRepId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: false,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const enterGuestMode = () => setIsGuest(true);
  const exitGuestMode = () => setIsGuest(false);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthTypes.User | null) => {
      if (firebaseUser) {
        // Check if user is a store owner
        const storeQuery = query(
          collection(db, 'storeProfiles'),
          where('ownerId', '==', firebaseUser.uid),
          limit(1),
        );
        const storeSnap = await getDocs(storeQuery);

        const isStoreOwner = !storeSnap.empty;
        let storeId: string | undefined = isStoreOwner ? storeSnap.docs[0].id : undefined;
        let userRole: AuthUser['userRole'] = 'buyer';
        let subAccountRole: AuthUser['subAccountRole'];
        let subAccountId: string | undefined;
        let crmRepId: string | undefined;
        let teamMemberName: string | undefined;

        if (isStoreOwner) {
          userRole = 'owner';
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as {
                role?: string;
                name?: string;
                subAccountRole?: AuthUser['subAccountRole'];
                subAccountId?: string;
                storeId?: string;
                activeStoreId?: string;
                crmRepId?: string;
              };
              teamMemberName = String(userData.name || '').trim() || undefined;
              if (userData.role === 'admin') {
                storeId =
                  (typeof userData.storeId === 'string' && userData.storeId.trim()) ||
                  (typeof userData.activeStoreId === 'string' && userData.activeStoreId.trim()) ||
                  undefined;
                userRole = 'owner';
              } else if (userData.role === 'sub_account') {
                subAccountId = userData.subAccountId;
                if (subAccountId) {
                  const subDoc = await getDoc(doc(db, 'subAccounts', subAccountId));
                  if (subDoc.exists()) {
                    const sub = subDoc.data() as { storeId?: string; role?: string; name?: string };
                    if (typeof sub.storeId === 'string' && sub.storeId.trim()) {
                      storeId = sub.storeId.trim();
                    }
                    subAccountRole = (sub.role || userData.subAccountRole) as AuthUser['subAccountRole'];
                    const subName = String(sub.name || '').trim();
                    if (subName) teamMemberName = subName;
                  }
                }
                if (!storeId && typeof userData.storeId === 'string' && userData.storeId.trim()) {
                  storeId = userData.storeId.trim();
                }
                subAccountRole = subAccountRole || userData.subAccountRole;
                if (subAccountRole === 'sales') userRole = 'sub_seller';
                else if (subAccountRole === 'manager') userRole = 'sub_manager';
                else if (subAccountRole === 'delivery') userRole = 'sub_delivery';
                else userRole = 'sub_seller';
              } else if (userData.role === 'crm_rep' && userData.crmRepId) {
                storeId = userData.storeId;
                userRole = 'crm_rep';
                crmRepId = userData.crmRepId;
              }
            }

            if (userRole === 'buyer') {
              const sellerDoc = await getDoc(doc(db, 'sellers', firebaseUser.uid));
              if (sellerDoc.exists()) {
                const sellerData = sellerDoc.data() as {
                  role?: string;
                  isSeller?: boolean;
                  storeId?: string;
                };
                if (sellerData.role === 'admin' || sellerData.isSeller === true) {
                  storeId = sellerData.storeId || storeId;
                  userRole = 'owner';
                }
              }
            }
          } catch {
            // Ignore sub-account lookup failures and continue as buyer
          }
        }

        if (userRole === 'owner' && !teamMemberName) {
          try {
            const ownerDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (ownerDoc.exists()) {
              const ownerData = ownerDoc.data() as { name?: string };
              teamMemberName = String(ownerData.name || '').trim() || undefined;
            }
          } catch {
            // optional
          }
        }
        if (!teamMemberName && firebaseUser.email) {
          teamMemberName = firebaseUser.email.split('@')[0];
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          teamMemberName,
          isStoreOwner,
          storeId,
          userRole,
          subAccountRole,
          subAccountId,
          crmRepId,
        });

        if (isStoreTeamMember(userRole)) {
          void setDoc(doc(db, 'users', firebaseUser.uid), { notifPref: 'all' }, { merge: true });
        }
      } else {
        setUser(null);
        // Do NOT reset isGuest here — guest mode is set intentionally by the user
        // and should only be cleared via exitGuestMode() (e.g. tapping "Sign In" in Profile)
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try { await GoogleSignin.signOut(); } catch (_) {}
    return firebaseSignOut(getAuth());
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, enterGuestMode, exitGuestMode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
