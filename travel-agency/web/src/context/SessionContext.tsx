import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { DEMO_STORE_ID, isTravelDemo } from '../lib/demoMode';

type SessionCtx = {
  user: User | null;
  loading: boolean;
  demoSession: boolean;
  storeId: string;
  setStoreId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  enterDemo: () => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoSession, setDemoSession] = useState(() => sessionStorage.getItem('travelDemo') === '1');
  const [storeId, setStoreId] = useState(() =>
    isTravelDemo() || sessionStorage.getItem('travelDemo') === '1'
      ? DEMO_STORE_ID
      : localStorage.getItem('travelStoreId') || '',
  );

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      const defaultStore = import.meta.env.VITE_DEFAULT_STORE_ID;
      if (u && defaultStore && !demoSession) {
        setStoreId(defaultStore);
      }
    });
  }, [demoSession]);

  useEffect(() => {
    if (storeId) localStorage.setItem('travelStoreId', storeId);
  }, [storeId]);

  const value = useMemo(
    () => ({
      user,
      loading: isTravelDemo() ? false : loading,
      demoSession,
      storeId,
      setStoreId,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      enterDemo: () => {
        sessionStorage.setItem('travelDemo', '1');
        setDemoSession(true);
        setStoreId(DEMO_STORE_ID);
      },
      logout: async () => {
        sessionStorage.removeItem('travelDemo');
        setDemoSession(false);
        if (user) await signOut(auth);
      },
    }),
    [user, loading, storeId, demoSession],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('SessionProvider missing');
  return ctx;
}
