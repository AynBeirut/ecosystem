import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFirestore, doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { useAuth } from '@/context/useAuth';
import { getActualStoreId } from '@/lib/storeUtils';
import { resolveStoreEntitlements, type StoreEntitlements } from '@/lib/entitlements';
import type { StoreProfile } from '@/types/storeProfile';

export function useStoreEntitlements() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const storeId = user ? getActualStoreId(user) : null;

  const load = useCallback(async (options?: { silent?: boolean; fromServer?: boolean }) => {
    if (!storeId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    if (!options?.silent) setLoading(true);
    try {
      const ref = doc(getFirestore(), 'storeProfiles', storeId);
      const snap = options?.fromServer
        ? await getDocFromServer(ref).catch(() => getDoc(ref))
        : await getDoc(ref);
      setProfile(snap.exists() ? (snap.data() as StoreProfile) : null);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onProfileUpdated = () => {
      void load({ silent: true, fromServer: true });
    };
    window.addEventListener('grabio:store-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('grabio:store-profile-updated', onProfileUpdated);
  }, [load]);

  const entitlements = useMemo<StoreEntitlements | null>(
    () => resolveStoreEntitlements(profile),
    [profile],
  );

  const canUse = useCallback(
    (moduleId: string) => Boolean(entitlements?.modules[moduleId]),
    [entitlements],
  );

  return { profile, entitlements, loading, storeId, canUse, reload: load };
}
