import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getFinanceAuth, getFinanceAuthReady } from '@/integrations/firebase/client';
import { canUseInvoiceModule } from '@/lib/grabio/entitlements';
import { loadStoreProfile, resolveGrabioStore } from '@/lib/grabio/storeService';
import { syncSystemGuideFromProfile } from '@/lib/systemGuide';
import type { GrabioStoreContext, GrabioStoreProfile } from '@/lib/grabio/types';
import { setDefaultNumberFormat } from '@/lib/money/format';

export function useGrabioStore(): GrabioStoreContext & {
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  invoiceModuleEnabled: boolean;
  reload: () => Promise<void>;
} {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [profile, setProfile] = useState<GrabioStoreProfile | null>(null);
  const [role, setRole] = useState<GrabioStoreContext['role']>('member');
  const [loading, setLoading] = useState(false);

  const hydrateStore = useCallback(async (user: FirebaseUser) => {
    setLoading(true);
    try {
      const resolved = await resolveGrabioStore(user.uid, user.email || '');
      setStoreId(resolved.storeId);
      setProfile(resolved.profile);
      syncSystemGuideFromProfile(resolved.profile?.systemGuideEnabled);
      setRole(resolved.role);
      setDefaultNumberFormat(resolved.profile?.numberFormat);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!firebaseUser || !storeId) return;
    setLoading(true);
    try {
      const next = await loadStoreProfile(storeId);
      if (next) {
        setProfile(next);
        syncSystemGuideFromProfile(next.systemGuideEnabled);
        setDefaultNumberFormat(next.numberFormat);
      }
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, storeId]);

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;

    const init = async () => {
      await getFinanceAuthReady();
      if (!mounted) return;

      unsub = onAuthStateChanged(getFinanceAuth(), (user) => {
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

  useEffect(() => {
    const onProfileUpdated = () => {
      void reload();
    };
    window.addEventListener('grabio:store-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('grabio:store-profile-updated', onProfileUpdated);
  }, [reload]);

  return {
    firebaseUser,
    authLoading,
    storeId,
    profile,
    role,
    loading,
    invoiceModuleEnabled: canUseInvoiceModule(profile),
    reload,
  };
}
