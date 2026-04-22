import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
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
import { getMessaging, getToken } from '@react-native-firebase/messaging';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isStoreOwner: boolean;
  storeId?: string;
  userRole: 'owner' | 'sub_seller' | 'sub_manager' | 'sub_delivery' | 'buyer';
  subAccountRole?: 'sales' | 'delivery' | 'manager';
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

        if (isStoreOwner) {
          userRole = 'owner';
        } else {
          // Check if sub-account user
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data() as any;
              if (userData.role === 'sub_account') {
                subAccountRole = userData.subAccountRole;
                storeId = userData.subAccountId || userData.storeId;
                if (subAccountRole === 'sales') userRole = 'sub_seller';
                else if (subAccountRole === 'manager') userRole = 'sub_manager';
                else if (subAccountRole === 'delivery') userRole = 'sub_delivery';
                else userRole = 'sub_seller';
              }
            }
          } catch (_) {}
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isStoreOwner,
          storeId,
          userRole,
          subAccountRole,
        });

        // Register FCM token
        try {
          const token = await getToken(getMessaging());
          if (token) {
            await setDoc(
              doc(db, 'users', firebaseUser.uid, 'fcmTokens', token),
              { token, createdAt: FieldValue.serverTimestamp() },
            );
          }
        } catch (_) {
          // FCM token registration is non-critical
        }
      } else {
        setUser(null);
        setIsGuest(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = () => firebaseSignOut(getAuth());

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, enterGuestMode, exitGuestMode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
