import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from '@react-native-firebase/auth';
import {
  getFirestore,
  FieldValue,
  collection,
  where,
  limit,
  getDocs,
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
        // Check if user is a store owner
        const storeQuery = query(
          collection(db, 'storeProfiles'),
          where('ownerId', '==', firebaseUser.uid),
          limit(1),
        );
        const storeSnap = await getDocs(storeQuery);

        const isStoreOwner = !storeSnap.empty;
        const storeId = isStoreOwner ? storeSnap.docs[0].id : undefined;

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          isStoreOwner,
          storeId,
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
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = () => firebaseSignOut(getAuth());

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
