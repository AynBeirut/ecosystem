import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, authReady } from '@/integrations/firebase/client';
import { canUseInvoiceModule } from '@/lib/grabio/entitlements';
import { loadStoreProfile, resolveGrabioStore } from '@/lib/grabio/storeService';
import type { GrabioStoreContext, GrabioStoreProfile } from '@/lib/grabio/types';
import { GUEST_DEMO_STORE_ID, isGuestDemoActive } from '@/lib/guestDemo';

export function useGrabioStore(): GrabioStoreContext & {
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  invoiceModuleEnabled: boolean;
  reload: () => Promise<void>;
} {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(() => !isGuestDemoActive());
  const [storeId, setStoreId] = useState(() => (isGuestDemoActive() ? GUEST_DEMO_STORE_ID : ''));
  const [profile, setProfile] = useState<GrabioStoreProfile | null>(null);
  const [role, setRole] = useState<GrabioStoreContext['role']>(() => (isGuestDemoActive() ? 'owner' : 'member'));
  const [loading, setLoading] = useState(false);

  const hydrateStore = useCallback(async (user: FirebaseUser) => {
    setLoading(true);
    try {
      const resolved = await resolveGrabioStore(user.uid, user.email || '');
      setStoreId(resolved.storeId);
      setProfile(resolved.profile);
      setRole(resolved.role);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    if (isGuestDemoActive()) return;
    if (!firebaseUser || !storeId) return;
    setLoading(true);
    try {
      const next = await loadStoreProfile(storeId);
      if (next) setProfile(next);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, storeId]);

  useEffect(() => {
    if (isGuestDemoActive()) {
      setAuthLoading(false);
      setStoreId(GUEST_DEMO_STORE_ID);
      setRole('owner');
      setLoading(false);
      return;
    }

    let mounted = true;
    let unsub: (() => void) | undefined;

    const init = async () => {
      await authReady;
      if (!mounted) return;

      unsub = onAuthStateChanged(auth, (user) => {
        if (!mounted) return;
        setFirebaseUser(user);
        setAuthLoading(false);
        if (user) {
          void hydrateStore(user);
        } else {
          setStoreId('');
          setProfile(null);
          setRole('member');
          setLoading(false);
        }
      });
    };

    void init();
    return () => {
      mounted = false;
      unsub?.();
    };
  }, [hydrateStore]);

  return {
    firebaseUser,
    authLoading,
    storeId,
    profile,
    role,
    loading,
    invoiceModuleEnabled: isGuestDemoActive() || canUseInvoiceModule(profile),
    reload,
  };
}
