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
} from '@react-native-firebase/firestore';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isStoreOwner: boolean;
  storeId?: string;
  userRole: 'owner' | 'sub_seller' | 'sub_manager' | 'sub_delivery' | 'crm_rep' | 'buyer';
  subAccountRole?: 'sales' | 'delivery' | 'manager';
  crmRepId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthTypes.User | null) => {
      if (firebaseUser) {
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
        let crmRepId: string | undefined;

        if (isStoreOwner) {
          userRole = 'owner';
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as {
                role?: string;
                subAccountRole?: AuthUser['subAccountRole'];
                subAccountId?: string;
                storeId?: string;
                crmRepId?: string;
              };
              if (userData.role === 'sub_account') {
                subAccountRole = userData.subAccountRole;
                storeId = userData.storeId || userData.subAccountId;
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
          } catch {
            // continue as buyer
          }
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isStoreOwner,
          storeId,
          userRole,
          subAccountRole,
          crmRepId,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore
    }
    return firebaseSignOut(getAuth());
  };

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
