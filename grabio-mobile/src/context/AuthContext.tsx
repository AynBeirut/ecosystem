import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  getFirestore,
  FieldValue,
  collection,
  where,
  limit,
  getDocs,
  getDoc,
  query,
  doc,
  setDoc,
} from '@react-native-firebase/firestore';
import { getMessaging, getToken, requestPermission, AuthorizationStatus } from '@react-native-firebase/messaging';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthUser {
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
        let crmRepId: string | undefined;

        if (isStoreOwner) {
          userRole = 'owner';
        } else {
          // Check if sub-account user
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
            // Ignore sub-account lookup failures and continue as buyer
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

        // Register FCM token after notification permission is granted
        try {
          const msg = getMessaging();
          const authStatus = await requestPermission(msg);
          const enabled =
            authStatus === AuthorizationStatus.AUTHORIZED ||
            authStatus === AuthorizationStatus.PROVISIONAL;
          if (enabled) {
            const token = await getToken(msg);
            if (token) {
              await setDoc(
                doc(db, 'users', firebaseUser.uid, 'fcmTokens', token),
                { token, platform: 'mobile', createdAt: FieldValue.serverTimestamp() },
                { merge: true },
              );
              if (storeId) {
                await setDoc(
                  doc(db, 'users', firebaseUser.uid),
                  { storeId, email: firebaseUser.email || null },
                  { merge: true },
                );
              }
            }
          }
        } catch (_) {
          // FCM token registration is non-critical
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
